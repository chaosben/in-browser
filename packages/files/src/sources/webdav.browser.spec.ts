import { describe, expect, it } from 'vitest';
import { parseListing } from './s3';
import { davUrl, parsePropfind } from './webdav';

// Answers of real servers name entries in their own way: names must come back exactly, whatever the encoding

describe('WebDAV', () => {
	const base = 'https://cloud.example.com/remote.php/dav/files/anna/Shared%20Stuff/';
	const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
	<d:response><d:href>/remote.php/dav/files/anna/Shared%20Stuff/</d:href>
		<d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
		<d:propstat><d:prop><d:getcontentlength/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>
	<d:response><d:href>/remote.php/dav/files/anna/Shared%20Stuff/M%c3%bcller%20%26%20Co%2550%25%20%232.pdf</d:href>
		<d:propstat><d:prop><d:resourcetype/><d:getcontentlength>1234</d:getcontentlength><d:getlastmodified>Sat, 21 Nov 2026 10:00:00 GMT</d:getlastmodified><d:getetag>"abc"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
	<d:response><d:href>https://cloud.example.com/remote.php/dav/files/anna/Shared%20Stuff/Fotos%202026/</d:href>
		<d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
	<d:response><d:href>/remote.php/dav/files/anna/Shared%20Stuff/a%3Ab.txt</d:href>
		<d:propstat><d:prop><d:resourcetype/><d:getcontentlength>1</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`;

	it('reads entries with spaces, umlauts, %, & and # in their names; leaves out names we can’t take', () => {
		const entries = parsePropfind(xml, base);
		expect(entries.map((e) => [e.path, e.kind])).toEqual([
			['/', 'directory'],
			['/Müller & Co%50% #2.pdf', 'file'],
			['/Fotos 2026', 'directory']
		]);
		expect(entries[1]).toMatchObject({ size: 1234, modified: Date.parse('2026-11-21T10:00:00Z'), etag: '"abc"' });
	});

	it('addresses paths with every name encoded', () => {
		expect(davUrl(base, '/Müller & Co%50% #2.pdf')).toBe(base + 'M%C3%BCller%20%26%20Co%2550%25%20%232.pdf');
		expect(davUrl(base, '/Fotos 2026', true)).toBe(base + 'Fotos%202026/');
	});
});

describe('S3 listing', () => {
	it('reads files, folders (common prefixes) and the next page', () => {
		const page = parseListing(`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
	<Name>bucket</Name><Prefix>docs/</Prefix><IsTruncated>true</IsTruncated><NextContinuationToken>t2</NextContinuationToken>
	<Contents><Key>docs/</Key><Size>0</Size><LastModified>2026-11-21T10:00:00.000Z</LastModified></Contents>
	<Contents><Key>docs/a &amp; b.txt</Key><Size>5</Size><LastModified>2026-11-21T10:00:00.000Z</LastModified><ETag>"e1"</ETag></Contents>
	<CommonPrefixes><Prefix>docs/Fotos 2026/</Prefix></CommonPrefixes>
</ListBucketResult>`);
		expect(page.files.map((f) => [f.key, f.size])).toEqual([
			['docs/', 0],
			['docs/a & b.txt', 5]
		]);
		expect(page.prefixes).toEqual(['docs/Fotos 2026/']);
		expect(page.next).toBe('t2');
	});
});
