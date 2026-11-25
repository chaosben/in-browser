import { describe, expect, it, vi } from 'vitest';
import { fetchFresh } from './fetch-fresh.js';

describe('fetchFresh', () => {
	// Regression: a 404 kept by the HTTP cache for a year made a tool show 500 on one phone after a deploy
	it('asks for a failed build file again past the HTTP cache', async () => {
		const fetcher = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => new Response('', { status: init?.cache === 'reload' ? 200 : 404 }));
		const response = await fetchFresh('/_app/immutable/chunks/a.js', fetcher as typeof fetch);
		expect(response.status).toBe(200);
		expect(fetcher).toHaveBeenLastCalledWith('/_app/immutable/chunks/a.js', { cache: 'reload' });
	});
});
