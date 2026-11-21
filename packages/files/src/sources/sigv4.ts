// AWS Signature Version 4 for S3-compatible storage (AWS, Cloudflare R2, Backblaze B2, Wasabi, MinIO …), with
// WebCrypto only. Signs the headers of one request; the secret key never leaves this module's arguments.

export interface SignInput {
	method: string;
	/** The request's address; its path must already be encoded the way it is sent (`encodePath`) */
	url: URL;
	/** Headers to sign besides host, x-amz-date and x-amz-content-sha256 (names in any case) */
	headers?: Record<string, string>;
	/** Hex SHA-256 of the body, or `UNSIGNED-PAYLOAD` */
	payloadHash: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	date?: Date;
	service?: string;
}

const encoder = new TextEncoder();

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (data: string | Uint8Array<ArrayBuffer>) =>
	hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? encoder.encode(data) : data));

/** SHA-256 of an empty body */
export const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, text: string): Promise<ArrayBuffer> {
	const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return crypto.subtle.sign('HMAC', k, encoder.encode(text));
}

/** URI encoding as SigV4 wants it (RFC 3986: also `!'()*`) */
export const uriEncode = (text: string) => encodeURIComponent(text).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** A key's path with every segment encoded (`/` kept) */
export const encodePath = (path: string) => path.split('/').map(uriEncode).join('/');

/** The headers to send: the given ones plus `x-amz-date`, `x-amz-content-sha256` and `Authorization` */
export async function sign(input: SignInput): Promise<Record<string, string>> {
	const date = input.date ?? new Date();
	const amzDate = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
	const day = amzDate.slice(0, 8);
	const service = input.service ?? 's3';
	const headers: Record<string, string> = {
		...Object.fromEntries(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
		host: input.url.host,
		'x-amz-date': amzDate,
		'x-amz-content-sha256': input.payloadHash
	};
	const names = Object.keys(headers).sort();
	const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, ' ')}\n`).join('');
	const signedHeaders = names.join(';');
	const query = [...input.url.searchParams]
		.map(([k, v]) => [uriEncode(k), uriEncode(v)])
		.sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
		.map(([k, v]) => `${k}=${v}`)
		.join('&');
	const canonical = [input.method, input.url.pathname || '/', query, canonicalHeaders, signedHeaders, input.payloadHash].join('\n');
	const scope = `${day}/${input.region}/${service}/aws4_request`;
	const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonical)].join('\n');
	let key = await hmac(encoder.encode('AWS4' + input.secretAccessKey), day);
	for (const part of [input.region, service, 'aws4_request']) key = await hmac(key, part);
	const signature = hex(await hmac(key, toSign));
	const { host: _, ...rest } = headers;
	return { ...rest, authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}
