// What is written to a file of an encrypted folder is collected in memory, never in a temporary file (it is plain)

/** Collects what is written in memory (positions, seeking and truncating like a file's stream) */
export function memoryWritable(store: (bytes: Uint8Array) => Promise<void>): WritableStream<FileSystemWriteChunkType> {
	let buffer = new Uint8Array(64 * 1024);
	let size = 0;
	let position = 0;
	const fit = (end: number) => {
		if (end <= buffer.length) return;
		const larger = new Uint8Array(Math.max(end, buffer.length * 2));
		larger.set(buffer.subarray(0, size));
		buffer = larger;
	};
	const bytesOf = async (data: unknown): Promise<Uint8Array> => {
		if (typeof data === 'string') return new TextEncoder().encode(data);
		if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
		if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
		if (data instanceof ArrayBuffer) return new Uint8Array(data);
		throw new TypeError('unsupported chunk');
	};
	const put = (bytes: Uint8Array, at: number) => {
		fit(at + bytes.length);
		if (at > size) buffer.fill(0, size, at);
		buffer.set(bytes, at);
		size = Math.max(size, at + bytes.length);
		position = at + bytes.length;
	};
	return new WritableStream<FileSystemWriteChunkType>({
		async write(chunk) {
			// A Blob has a `type` too: only write parameters are objects with a type of their own
			if (chunk && typeof chunk === 'object' && !(chunk instanceof Blob) && !ArrayBuffer.isView(chunk) && !(chunk instanceof ArrayBuffer) && 'type' in chunk) {
				if (chunk.type === 'seek') position = chunk.position ?? 0;
				else if (chunk.type === 'truncate') {
					const to = chunk.size ?? 0;
					fit(to);
					if (to > size) buffer.fill(0, size, to);
					size = to;
					position = Math.min(position, size);
				} else put(await bytesOf(chunk.data), chunk.position ?? position);
				return;
			}
			put(await bytesOf(chunk), position);
		},
		close: () => store(buffer.subarray(0, size)),
		abort() {
			buffer = new Uint8Array();
		}
	});
}
