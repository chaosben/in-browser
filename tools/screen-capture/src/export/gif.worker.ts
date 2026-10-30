// Encodes GIF frames off the main thread (see `GifWriter`)
import { GifWriter, type GifReply, type GifRequest } from './gif';

let writer: GifWriter | null = null;

self.onmessage = (event: MessageEvent<GifRequest>) => {
	const request = event.data;
	let reply: GifReply;
	try {
		if (request.type === 'start') {
			writer = new GifWriter(request.width, request.height, request.loop);
			reply = { type: 'bytes', bytes: null };
		} else {
			if (!writer) throw new Error('GIF encoder not started.');
			const bytes =
				request.type === 'frame' ? writer.add(new Uint8ClampedArray(request.rgba), request.delay) : writer.finish();
			reply = { type: 'bytes', bytes };
		}
	} catch (e) {
		reply = { type: 'error', message: e instanceof Error ? e.message : String(e) };
	}
	self.postMessage(reply, { transfer: reply.type === 'bytes' && reply.bytes ? [reply.bytes.buffer] : [] });
};
