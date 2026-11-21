import { describe, expect, it } from 'vitest';
import { EMPTY_HASH, encodePath, sign } from './sigv4';

// The examples of the AWS documentation (“Signature Calculations for the Authorization Header: Transferring Payload in
// a Single Chunk”): same keys, date and requests, so the signatures must match exactly.
const credentials = {
	region: 'us-east-1',
	accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
	secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
	date: new Date('2013-05-24T00:00:00Z')
};
const signature = (headers: Record<string, string>) => headers.authorization.split('Signature=')[1];

describe('SigV4', () => {
	it.each([
		['GET object with a range', 'https://examplebucket.s3.amazonaws.com/test.txt', { range: 'bytes=0-9' }, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'],
		['GET bucket lifecycle', 'https://examplebucket.s3.amazonaws.com/?lifecycle', {}, 'fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543'],
		['list objects', 'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J', {}, '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7']
	])('%s', async (_name, url, headers, expected) => {
		const signed = await sign({ ...credentials, method: 'GET', url: new URL(url), headers, payloadHash: EMPTY_HASH });
		expect(signature(signed)).toBe(expected);
	});

	it('PUT object with an encoded key and extra headers', async () => {
		const signed = await sign({
			...credentials,
			method: 'PUT',
			url: new URL('https://examplebucket.s3.amazonaws.com' + encodePath('/test$file.text')),
			headers: { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
			payloadHash: '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072'
		});
		expect(signature(signed)).toBe('98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
	});
});
