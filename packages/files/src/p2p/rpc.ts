import { fromUtf8, utf8 } from './bytes.js';
import type { Link } from './link.js';

// Requests between two devices over a Link, with streamed uploads and downloads (files of any size).
// A frame is `[4 bytes header length][header JSON][body]`. Header kinds:
//   q request {i, m, p, up}   u upload chunk {i}   U upload end {i}
//   r response {i, v, down}   d download chunk {i} D download end {i}   x error {i, e}

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface Header {
	k: 'q' | 'u' | 'U' | 'r' | 'd' | 'D' | 'x';
	i: number;
	m?: string;
	p?: Json;
	v?: Json;
	e?: string;
	up?: 1;
	down?: 1;
}

export const CHUNK = 64 * 1024;

export function encodeFrame(header: object, body?: Uint8Array): Uint8Array<ArrayBuffer> {
	const head = utf8(JSON.stringify(header));
	const frame = new Uint8Array(4 + head.length + (body?.length ?? 0));
	new DataView(frame.buffer).setUint32(0, head.length);
	frame.set(head, 4);
	if (body) frame.set(body, 4 + head.length);
	return frame;
}

export function decodeFrame<T = unknown>(frame: Uint8Array<ArrayBuffer>): { header: T; body: Uint8Array<ArrayBuffer> } {
	const length = new DataView(frame.buffer, frame.byteOffset).getUint32(0);
	return {
		header: JSON.parse(fromUtf8(frame.subarray(4, 4 + length))) as T,
		body: frame.subarray(4 + length)
	};
}

/**
 * What the other side learns of an error: its message – but of a system error (a file system's, with `syscall`) only
 * the code, since its message names where things lie on this device.
 */
function wireText(e: unknown): string {
	if (!(e instanceof Error)) return String(e);
	const system = e as { code?: unknown; syscall?: unknown };
	return typeof system.syscall === 'string' && typeof system.code === 'string' ? system.code : e.message;
}

export class RemoteError extends Error {
	override name = 'RemoteError';
}

/** What a request handler returns: a value, and optionally a stream the caller downloads */
export interface Reply {
	value?: Json;
	download?: ReadableStream<Uint8Array>;
}

export type Handler = (params: Json, upload: ReadableStream<Uint8Array> | null) => Promise<Reply | void>;

interface Pending {
	resolve: (value: Json) => void;
	reject: (error: Error) => void;
	download?: WritableStreamDefaultWriter<Uint8Array>;
	writes: Promise<void>;
	value?: Json;
	onProgress?: (bytes: number) => void;
	received: number;
}

export class Rpc {
	private next = 1;
	private pending = new Map<number, Pending>();
	private uploads = new Map<number, ReadableStreamDefaultController<Uint8Array>>();
	private handlers = new Map<string, Handler>();
	private sending: Promise<void> = Promise.resolve();
	private closed = false;

	constructor(private link: Link) {
		link.onFrame((frame) => this.receive(frame));
		link.onClose(() => this.shutDown(new Error('Connection closed')));
	}

	handle(method: string, handler: Handler) {
		this.handlers.set(method, handler);
	}

	/**
	 * Calls `method` on the other device. `upload` streams a body along; `download` receives the stream the other side
	 * replies with (closed when complete). Resolves with the reply value after both are complete.
	 */
	call(
		method: string,
		params: Json = null,
		options: { upload?: ReadableStream<Uint8Array>; download?: WritableStream<Uint8Array>; onProgress?: (bytes: number) => void } = {}
	): Promise<Json> {
		if (this.closed) return Promise.reject(new Error('Connection closed'));
		const i = this.next++;
		const result = new Promise<Json>((resolve, reject) => {
			this.pending.set(i, {
				resolve,
				reject,
				download: options.download?.getWriter(),
				writes: Promise.resolve(),
				onProgress: options.onProgress,
				received: 0
			});
		});
		this.send({ k: 'q', i, m: method, p: params, up: options.upload ? 1 : undefined });
		if (options.upload) this.stream(i, options.upload, 'u', 'U', options.onProgress).catch((e) => this.fail(i, e));
		return result;
	}

	close() {
		this.shutDown(new Error('Connection closed'));
		this.link.close();
	}

	private shutDown(error: Error) {
		if (this.closed) return;
		this.closed = true;
		for (const pending of this.pending.values()) {
			pending.download?.abort(error).catch(() => {});
			pending.reject(error);
		}
		this.pending.clear();
		for (const controller of this.uploads.values()) controller.error(error);
		this.uploads.clear();
	}

	private fail(i: number, error: unknown) {
		const pending = this.pending.get(i);
		if (!pending) return;
		this.pending.delete(i);
		pending.download?.abort(error).catch(() => {});
		pending.reject(error instanceof Error ? error : new Error(String(error)));
	}

	/** Frames go out one after the other, each waiting for the previous one (keeps the order, gives backpressure) */
	private send(header: Header, body?: Uint8Array): Promise<void> {
		const frame = encodeFrame(header, body);
		this.sending = this.sending.then(() => this.link.send(frame)).catch(() => {});
		return this.sending;
	}

	private async stream(i: number, source: ReadableStream<Uint8Array>, chunk: 'u' | 'd', end: 'U' | 'D', onProgress?: (bytes: number) => void) {
		const reader = source.getReader();
		let sent = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			for (let offset = 0; offset < value.length; offset += CHUNK) {
				const part = value.subarray(offset, offset + CHUNK);
				await this.send({ k: chunk, i }, part);
				sent += part.length;
				onProgress?.(sent);
			}
		}
		await this.send({ k: end, i });
	}

	private receive(frame: Uint8Array<ArrayBuffer>) {
		const { header, body } = decodeFrame<Header>(frame);
		const { k, i } = header;
		if (k === 'q') this.serve(header, body);
		else if (k === 'u') this.uploads.get(i)?.enqueue(body.slice());
		else if (k === 'U') {
			this.uploads.get(i)?.close();
			this.uploads.delete(i);
		} else {
			const pending = this.pending.get(i);
			if (!pending) return;
			if (k === 'x') this.fail(i, new RemoteError(header.e));
			else if (k === 'r') {
				if (header.down && pending.download) pending.value = header.v ?? null;
				else this.finish(i, header.v ?? null);
			} else if (k === 'd' && pending.download) {
				const data = body.slice();
				pending.writes = pending.writes.then(() => pending.download!.write(data));
				// A lost connection aborts the download: the call fails through `shutDown`, not through this chain
				pending.writes.catch(() => {});
				pending.received += data.length;
				pending.onProgress?.(pending.received);
			} else if (k === 'D') {
				pending.writes = pending.writes.then(() => pending.download!.close());
				pending.writes.then(
					() => this.finish(i, pending.value ?? null),
					(e) => this.fail(i, e)
				);
			}
		}
	}

	private finish(i: number, value: Json) {
		const pending = this.pending.get(i);
		if (!pending) return;
		this.pending.delete(i);
		pending.resolve(value);
	}

	private async serve(header: Header, body: Uint8Array) {
		void body;
		const { i } = header;
		let upload: ReadableStream<Uint8Array> | null = null;
		if (header.up) {
			upload = new ReadableStream<Uint8Array>({ start: (controller) => void this.uploads.set(i, controller) });
		}
		try {
			const handler = this.handlers.get(header.m ?? '');
			if (!handler) throw new Error(`Unknown request: ${header.m}`);
			const reply = (await handler(header.p ?? null, upload)) ?? {};
			if (reply.download) {
				await this.send({ k: 'r', i, v: reply.value ?? null, down: 1 });
				await this.stream(i, reply.download, 'd', 'D');
			} else {
				await this.send({ k: 'r', i, v: reply.value ?? null });
			}
		} catch (e) {
			this.uploads.delete(i);
			await this.send({ k: 'x', i, e: wireText(e) });
		}
	}
}
