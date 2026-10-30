# in-browser

Tools that run entirely in the browser – no uploads, no backend, no tracking. This repository is one SvelteKit app
that serves the overview site and every tool on a single origin, so the tools can share browser storage.

| Folder | Content | Address |
| --- | --- | --- |
| `src/` | The app: overview page, thin routes per tool, Service Worker | https://in-browser.org |
| `tools/screen-capture` | `@in-browser/screen-capture`: record, edit and export screen videos | https://in-browser.org/screen-capture |
| `tools/files` | `@in-browser/files-app`: file manager of the shared browser storage, sync with a folder on disk | https://in-browser.org/files |
| `tools/text-editor` | `@in-browser/text-editor`: text, Markdown and code editor with tabs | https://in-browser.org/text-editor |
| `packages/brand` | `@in-browser/brand`: header, theme, language logic, PWA | – |
| `packages/files` | `@in-browser/files`: shared file system (OPFS), file dialog, sync | – |

Each tool is its own npm workspace package with its logic, components and texts; the app only has a few route
files per tool (`src/routes/<tool>/`). Tools never import from each other – shared code lives in `packages/` and is
consumed as source.

Stack: SvelteKit with Svelte 5 (runes), Tailwind CSS 4 + daisyUI 5, TypeScript, Vitest. The UI is available in
English and German (following the browser language).

## Development

```sh
npm install         # once (Node 26, see .node-version)
npm run dev         # overview and all tools (http://localhost:5173)
npm run check       # type check
npm test            # unit tests of the app, packages and tools
npm run build       # static build into build/
```

## Deployment

The whole site is one Cloudflare Worker (`in-browser`, static assets only, custom domain `in-browser.org`).

```sh
npx wrangler login      # once, opens the browser
npx wrangler whoami     # right account?
npm run deploy:check    # build + dry run, nothing is uploaded
npm run preview:cf      # local preview with real asset behaviour (http://localhost:8787)
npm run deploy          # build + upload
```

Header rules (CSP, Permissions-Policy per tool, caching) are in `static/_headers`. The footer of each tool shows the
commit it was built from.

## How this was built

in-browser is a co-work of Benjamin and Claude as an AI pair programmer: ideas, decisions
and testing by Benjamin, much of the implementation written together with Claude.

## License

[MIT](LICENSE). Bundled third-party software and its licenses are listed in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
