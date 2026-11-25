// Build files are served with a year of HTTP caching – the 404 page too, when one was asked for in the wrong moment
// (`static/_headers` can't tell them apart; e.g. while a deploy switches versions). A browser keeps that 404 for a year,
// so a failed build file is asked for once more past the HTTP cache, which also replaces the kept 404.

const IMMUTABLE = '/_app/immutable/';

export async function fetchFresh(request: Request | string, fetcher: typeof fetch = fetch): Promise<Response> {
	const response = await fetcher(request);
	if (response.ok || !new URL(typeof request === 'string' ? request : request.url, 'http://x').pathname.startsWith(IMMUTABLE)) return response;
	return fetcher(request, { cache: 'reload' });
}
