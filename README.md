# in-browser.de

Tools that run entirely in the browser – no uploads, no backend, no tracking. This monorepo (npm workspaces) holds
the overview site and the tools.

| Folder | Content | Address |
| --- | --- | --- |
| `apps/in-browser` | Overview site | https://in-browser.de |
| `apps/screen-capture` | Screen Capture: record, edit and export screen videos | https://screen-capture.in-browser.de |
| `packages/brand` | `@in-browser/brand`: header, theme, language logic, PWA | – |
| `packages/vite` | `@in-browser/vite`: shared Vite/SvelteKit/Vitest setup | – |

Shared code lives in `packages/` only and is consumed as source – nothing is copied between apps. Each app is its own
Cloudflare Worker (static assets only) and is deployed separately.

Stack: SvelteKit with Svelte 5 (runes), Tailwind CSS 4 + daisyUI 5, TypeScript, Vitest. The UI is available in
English and German (following the browser language).

## Development

```sh
npm install                           # once in the root (Node 26, see .node-version)
npm run dev -w apps/screen-capture    # start an app (http://localhost:5173)
npm run check                         # type check all apps
npm test                              # unit tests of all workspaces
npm run build                         # static builds into apps/*/build/
```

## Deployment

```sh
npx wrangler login                              # once, opens the browser
npx wrangler whoami                             # right account?
npm run deploy:check -w apps/<app>              # build + dry run, nothing is uploaded
npm run preview:cf -w apps/<app>                # local preview with real asset behaviour (http://localhost:8787)
npm run deploy -w apps/<app>                    # build + upload
```

The footer of each deployed app shows the commit it was built from.

## How this was built

in-browser.de is a co-work of Benjamin Schwarze and Claude (Anthropic) as an AI pair programmer: ideas, decisions
and testing by Benjamin, much of the implementation written together with Claude.

## License

[MIT](LICENSE). Bundled third-party software and its licenses are listed in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
