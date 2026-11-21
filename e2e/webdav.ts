import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// A small WebDAV server in memory for the E2E tests: the methods the WebDAV source uses (PROPFIND depth 0/1, GET with
// ranges, PUT, MKCOL, DELETE, MOVE), Basic sign-in and the CORS answers a browser needs from a real server.

interface Node {
	folder: boolean;
	data: Buffer;
	modified: Date;
}

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, HEAD, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE',
	'access-control-allow-headers': 'authorization, content-type, depth, destination, overwrite, range, if-match',
	'access-control-expose-headers': 'etag, content-range, content-length, last-modified'
};

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function fakeWebDav(user: string, password: string) {
	const files = new Map<string, Node>([['/', { folder: true, data: Buffer.alloc(0), modified: new Date() }]]);
	let server: Server | null = null;
	const expected = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');

	const pathOf = (url: string) => {
		const path = decodeURIComponent(new URL(url, 'http://x').pathname).replace(/\/+$/, '');
		return path.startsWith('/dav') ? path.slice(4) || '/' : null;
	};
	const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
	const etag = (node: Node) => `"${node.data.length}-${node.modified.getTime()}"`;
	const children = (folder: string) => [...files.keys()].filter((p) => p !== folder && parentOf(p) === folder);

	function entry(path: string, node: Node) {
		const href = '/dav' + path.split('/').map(encodeURIComponent).join('/') + (node.folder && path !== '/' ? '/' : '');
		const props = node.folder
			? '<d:resourcetype><d:collection/></d:resourcetype>'
			: `<d:resourcetype/><d:getcontentlength>${node.data.length}</d:getcontentlength><d:getlastmodified>${node.modified.toUTCString()}</d:getlastmodified><d:getetag>${escape(etag(node))}</d:getetag>`;
		return `<d:response><d:href>${escape(href)}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
	}

	async function body(req: IncomingMessage) {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		return Buffer.concat(chunks);
	}

	async function handle(req: IncomingMessage, res: ServerResponse) {
		const send = (status: number, headers: Record<string, string> = {}, content?: Buffer | string) => {
			res.writeHead(status, { ...CORS, ...headers });
			res.end(content);
		};
		if (req.method === 'OPTIONS') return send(204);
		if (req.headers.authorization !== expected) return send(401);
		const path = pathOf(req.url ?? '/');
		if (!path) return send(404);
		const node = files.get(path);
		switch (req.method) {
			case 'PROPFIND': {
				await body(req);
				if (!node) return send(404);
				const listed = [entry(path, node), ...(req.headers.depth === '1' && node.folder ? children(path).map((p) => entry(p, files.get(p)!)) : [])];
				return send(207, { 'content-type': 'application/xml; charset=utf-8' }, `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${listed.join('')}</d:multistatus>`);
			}
			case 'GET': {
				if (!node || node.folder) return send(404);
				if (req.headers['if-match'] && req.headers['if-match'] !== etag(node)) return send(412);
				const range = /bytes=(\d+)-(\d+)/.exec(req.headers.range ?? '');
				const headers = { etag: etag(node), 'last-modified': node.modified.toUTCString(), 'content-type': 'application/octet-stream' };
				if (!range) return send(200, headers, node.data);
				const [start, end] = [Number(range[1]), Math.min(Number(range[2]), node.data.length - 1)];
				return send(206, { ...headers, 'content-range': `bytes ${start}-${end}/${node.data.length}` }, node.data.subarray(start, end + 1));
			}
			case 'PUT': {
				const data = await body(req);
				if (!files.get(parentOf(path))?.folder) return send(409);
				files.set(path, { folder: false, data, modified: new Date() });
				return send(node ? 204 : 201);
			}
			case 'MKCOL':
				if (node) return send(405);
				if (!files.get(parentOf(path))?.folder) return send(409);
				files.set(path, { folder: true, data: Buffer.alloc(0), modified: new Date() });
				return send(201);
			case 'DELETE':
				if (!node) return send(404);
				for (const p of [...files.keys()]) if (p === path || p.startsWith(path + '/')) files.delete(p);
				return send(204);
			case 'MOVE': {
				const to = pathOf(req.headers.destination ?? '');
				if (!node || !to) return send(404);
				if (files.has(to) && req.headers.overwrite === 'F') return send(412);
				for (const p of [...files.keys()]) {
					if (p !== path && !p.startsWith(path + '/')) continue;
					files.set(to + p.slice(path.length), files.get(p)!);
					files.delete(p);
				}
				return send(201);
			}
			default:
				return send(405);
		}
	}

	return {
		files,
		/** Starts the server on a free local port; resolves to the address of its root folder */
		async listen(): Promise<string> {
			server = createServer((req, res) => void handle(req, res).catch(() => res.writeHead(500, CORS).end()));
			await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
			return `http://127.0.0.1:${(server.address() as AddressInfo).port}/dav/`;
		},
		close: () => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
	};
}
