import { FilesError, type Entry } from '../entry.js';
import { basename, nameProblem } from '../path.js';
import { bufferedWritable, headerInfo, rangeReader, send } from './http.js';
import { EMPTY_HASH, encodePath, sign, uriEncode } from './sigv4.js';
import type { Source } from './source.js';

// S3-compatible storage (AWS, Cloudflare R2, Backblaze B2, Wasabi, MinIO …) as a connected source. S3 has no folders:
// a folder is a common prefix of keys (`a/b/`), an empty one an empty object `a/b/`. Requests are signed with SigV4
// (`sigv4.ts`); the bucket must allow the site with CORS (help page “Connected folders”). No trash: deleting is for
// good. Moving copies and deletes, object by object.

export interface S3Config {
	/** e.g. `https://s3.eu-central-1.amazonaws.com`, `https://<account>.r2.cloudflarestorage.com` */
	endpoint: string;
	region: string;
	bucket: string;
	/** Folder inside the bucket used as the root (`''`: the whole bucket) */
	prefix: string;
	/** Bucket in the path (`endpoint/bucket/key`) instead of the host name (`bucket.endpoint/key`) */
	pathStyle: boolean;
	accessKeyId: string;
	secretAccessKey: () => Promise<string>;
}

/** Files from this size go up in parts (S3 takes one request up to 5 GB, parts make large uploads resumable per part) */
const MULTIPART_FROM = 16 * 1024 * 1024;
const PART = 8 * 1024 * 1024;
/** One copy request takes at most this much; larger objects are copied in parts */
const COPY_LIMIT = 5 * 1000 * 1000 * 1000;
const COPY_PART = 1024 * 1024 * 1024;
/** Requests at once when deleting or copying many objects */
const PARALLEL = 8;

export interface S3Listing {
	files: { key: string; size: number; modified: number; etag: string | null }[];
	prefixes: string[];
	next: string | null;
}

const tag = (parent: Element | Document, name: string) => parent.getElementsByTagName(name)[0]?.textContent ?? null;

/** One page of a ListObjectsV2 answer */
export function parseListing(xml: string): S3Listing {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	const files = [...doc.getElementsByTagName('Contents')].map((c) => ({
		key: tag(c, 'Key') ?? '',
		size: Number(tag(c, 'Size') ?? 0),
		modified: Date.parse(tag(c, 'LastModified') ?? '') || 0,
		etag: tag(c, 'ETag')
	}));
	const prefixes = [...doc.getElementsByTagName('CommonPrefixes')].map((p) => tag(p, 'Prefix') ?? '').filter(Boolean);
	const truncated = tag(doc, 'IsTruncated') === 'true';
	return { files, prefixes, next: truncated ? tag(doc, 'NextContinuationToken') : null };
}

/** The key prefix of the root, `''` or ending with `/` */
export const rootPrefix = (prefix: string) => {
	const clean = prefix.split('/').filter(Boolean).join('/');
	return clean ? clean + '/' : '';
};

export function s3Source(config: S3Config): Source {
	const root = rootPrefix(config.prefix);
	const endpoint = new URL(config.endpoint);
	const keyOf = (path: string) => root + path.split('/').filter(Boolean).join('/');
	const folderKey = (path: string) => (path === '/' ? root : keyOf(path) + '/');
	const pathOf = (key: string) => '/' + key.slice(root.length).replace(/\/$/, '');

	function urlOf(key: string, query: Record<string, string> = {}): URL {
		const url = config.pathStyle
			? new URL(`${endpoint.origin}${endpoint.pathname.replace(/\/$/, '')}/${uriEncode(config.bucket)}/${encodePath(key)}`)
			: new URL(`${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodePath(key)}`);
		for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
		// `URLSearchParams` writes spaces as `+`; S3 wants them like in the signature
		url.search = [...url.searchParams].map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`).join('&');
		return url;
	}

	async function request(
		method: string,
		key: string,
		path: string,
		init: { query?: Record<string, string>; headers?: Record<string, string>; body?: BodyInit; ok?: (s: number) => boolean; payloadHash?: string } = {}
	) {
		const url = urlOf(key, init.query);
		const headers = await sign({
			method,
			url,
			headers: init.headers,
			payloadHash: init.payloadHash ?? (init.body ? 'UNSIGNED-PAYLOAD' : EMPTY_HASH),
			region: config.region,
			accessKeyId: config.accessKeyId,
			secretAccessKey: await config.secretAccessKey()
		});
		return send(url.href, { method, headers, body: init.body }, path, init.ok);
	}

	/** Every page of a listing */
	async function listAll(prefix: string, delimiter: boolean, path: string): Promise<S3Listing> {
		const out: S3Listing = { files: [], prefixes: [], next: null };
		let token: string | null = null;
		do {
			const query: Record<string, string> = { 'list-type': '2', prefix, ...(delimiter ? { delimiter: '/' } : {}), ...(token ? { 'continuation-token': token } : {}) };
			const page = parseListing(await (await request('GET', '', path, { query })).text());
			out.files.push(...page.files);
			out.prefixes.push(...page.prefixes);
			token = page.next;
		} while (token);
		return out;
	}

	async function head(path: string) {
		const response = await request('HEAD', keyOf(path), path, { ok: (s) => (s >= 200 && s < 300) || s === 404 });
		return response.status === 404 ? null : headerInfo(response);
	}

	async function isFolder(path: string): Promise<boolean> {
		if (path === '/') return true;
		const page = parseListing(await (await request('GET', '', path, { query: { 'list-type': '2', prefix: folderKey(path), 'max-keys': '1' } })).text());
		return page.files.length > 0 || page.prefixes.length > 0;
	}

	async function inParallel<T>(items: T[], action: (item: T) => Promise<void>) {
		let next = 0;
		await Promise.all(
			Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
				while (next < items.length) await action(items[next++]);
			})
		);
	}

	async function upload(path: string, file: File) {
		const key = keyOf(path);
		if (file.size < MULTIPART_FROM) {
			await request('PUT', key, path, { body: file, headers: { 'content-type': file.type || 'application/octet-stream' } });
			return;
		}
		await multipart(path, key, Math.ceil(file.size / PART), async (part, query) => {
			const response = await request('PUT', key, path, { query, body: file.slice((part - 1) * PART, Math.min(file.size, part * PART)) });
			return response.headers.get('etag');
		});
	}

	/** A multipart upload: `put` sends one part and returns its ETag; aborted on any error */
	async function multipart(path: string, key: string, parts: number, put: (part: number, query: Record<string, string>) => Promise<string | null>) {
		const started = await (await request('POST', key, path, { query: { uploads: '' }, headers: { 'content-type': 'application/octet-stream' } })).text();
		const uploadId = parseUploadId(started);
		try {
			const etags: string[] = [];
			for (let part = 1; part <= parts; part++) {
				const etag = await put(part, { partNumber: String(part), uploadId });
				// Without `ExposeHeaders: ETag` in the bucket's CORS rules the browser hides it
				if (!etag) throw new Error('The bucket’s CORS rules must expose the ETag header.');
				etags.push(etag);
			}
			const body = `<CompleteMultipartUpload>${etags.map((etag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${etag}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
			await request('POST', key, path, { query: { uploadId }, body, headers: { 'content-type': 'application/xml' } });
		} catch (e) {
			await request('DELETE', key, path, { query: { uploadId } }).catch(() => {});
			throw e;
		}
	}

	async function copy(path: string, fromKey: string, toKey: string, size: number) {
		const source = `/${uriEncode(config.bucket)}/${encodePath(fromKey)}`;
		if (size <= COPY_LIMIT) {
			await request('PUT', toKey, path, { headers: { 'x-amz-copy-source': source } });
			return;
		}
		await multipart(path, toKey, Math.ceil(size / COPY_PART), async (part, query) => {
			const range = `bytes=${(part - 1) * COPY_PART}-${Math.min(size, part * COPY_PART) - 1}`;
			const xml = await (await request('PUT', toKey, path, { query, headers: { 'x-amz-copy-source': source, 'x-amz-copy-source-range': range } })).text();
			return tag(new DOMParser().parseFromString(xml, 'application/xml'), 'ETag');
		});
	}

	return {
		caps: { readOnly: false, trash: false },
		async list(path) {
			const prefix = folderKey(path);
			const listing = await listAll(prefix, true, path);
			const entries: Entry[] = [];
			for (const p of listing.prefixes) {
				const name = basename(pathOf(p));
				if (!nameProblem(name)) entries.push({ name, path: pathOf(p), kind: 'directory' });
			}
			for (const f of listing.files) {
				// The marker of the folder itself, and keys that end with `/` inside it (markers of empty folders)
				if (f.key === prefix || f.key.endsWith('/')) continue;
				const name = basename(pathOf(f.key));
				if (!nameProblem(name)) entries.push({ name, path: pathOf(f.key), kind: 'file', size: f.size, modified: f.modified });
			}
			if (!entries.length && path !== '/' && !(await isFolder(path))) throw new FilesError('notFound', path);
			return entries;
		},
		async stat(path) {
			if (path === '/') return { name: '', path, kind: 'directory' };
			const info = await head(path);
			if (info) return { name: basename(path), path, kind: 'file', size: info.size, modified: info.modified };
			return (await isFolder(path)) ? { name: basename(path), path, kind: 'directory' } : null;
		},
		async read(path) {
			const response = await request('GET', keyOf(path), path);
			const blob = await response.blob();
			return new File([blob], basename(path), { type: blob.type, lastModified: headerInfo(response).modified || Date.now() });
		},
		async open(path) {
			const info = await head(path);
			if (!info) throw new FilesError('notFound', path);
			return rangeReader(info, (headers) => request('GET', keyOf(path), path, { headers }));
		},
		writable: (path) => bufferedWritable((file) => upload(path, file)),
		async mkdir(path) {
			await request('PUT', folderKey(path), path, { body: new Blob([]) });
		},
		async remove(path) {
			if (await head(path)) {
				await request('DELETE', keyOf(path), path, { ok: (s) => (s >= 200 && s < 300) || s === 404 });
				return;
			}
			const all = await listAll(folderKey(path), false, path);
			await inParallel(all.files, async (f) => void (await request('DELETE', f.key, path, { ok: (s) => (s >= 200 && s < 300) || s === 404 })));
		},
		async move(from, to) {
			const info = await head(from);
			if (info) {
				await copy(from, keyOf(from), keyOf(to), info.size);
				await request('DELETE', keyOf(from), from);
				return;
			}
			const fromPrefix = folderKey(from);
			const toPrefix = folderKey(to);
			const all = await listAll(fromPrefix, false, from);
			if (!all.files.length) throw new FilesError('notFound', from);
			// Copy everything first, then delete: an interrupted move leaves a copy, never a loss
			await inParallel(all.files, (f) => copy(from, f.key, toPrefix + f.key.slice(fromPrefix.length), f.size));
			await inParallel(all.files, async (f) => void (await request('DELETE', f.key, from)));
		}
	};
}

function parseUploadId(xml: string): string {
	const id = tag(new DOMParser().parseFromString(xml, 'application/xml'), 'UploadId');
	if (!id) throw new Error('The server didn’t start the upload.');
	return id;
}
