# in-browser.de

Overview site of the in-browser.de tool family – tools that run entirely in the browser. Each tool is its own app
under its own subdomain (e.g. [Screen Capture](https://screen-capture.in-browser.de) in `apps/screen-capture`).

## Adding a tool

1. Add an entry to `src/lib/tools.ts` (`id`, `url`, `icon`, `requires`)
2. Add texts under `tools.<id>` in `src/lib/i18n/en.ts` (leading) and `de.ts` (name, description, features)
3. Put the card icon at `static/tools/<id>.svg` (ideally the tool's favicon)

## Development

From the monorepo root, see the [root README](../../README.md).

## Deployment

Static site on Cloudflare Workers (static assets) at **https://in-browser.de** – configuration in `wrangler.jsonc`,
header rules (CSP, Permissions-Policy, caching) in `static/_headers`.

Prerequisites: the zone `in-browser.de` is in the Cloudflare account and there is no DNS record for the apex domain
yet (the first deployment creates the custom domain including record and certificate). There is deliberately no
`*.workers.dev` address.

Commands (login, dry run, deploy) are in the [root README](../../README.md#deployment), e.g.
`npm run deploy:check -w apps/in-browser`.
