# in-browser

Tools that run entirely in the browser – no uploads, no backend, no tracking. This repository is one SvelteKit app
that serves the overview site and every tool on a single origin, so the tools can share browser storage.

| Folder | Content | Address |
| --- | --- | --- |
| `src/` | The app: overview page (launcher, installable as the app of the whole suite), thin routes per tool, Service Worker | https://in-browser.org |
| `tools/files` | `@in-browser/files-app`: file manager of the shared browser storage, connected folders on disk and servers (WebDAV, S3 – opened live), sync with a folder on disk and between devices | https://in-browser.org/files |
| `tools/text-editor` | `@in-browser/text-editor`: text, Markdown and code editor (one file per page); CSV as an editable table, JSON/YAML/TOML/XML as an editable tree, previews | https://in-browser.org/text-editor |
| `tools/pdf-editor` | `@in-browser/pdf-editor`: view, search, print and annotate PDFs, organize pages, fill in forms (with their calculations, run sandboxed), export pages as pictures or a JW Library playlist, present them (comments shown and hidden in steps, speaker notes, presenter view, remote control from a phone) – the file changed in place | https://in-browser.org/pdf-editor |
| `tools/screen-capture` | `@in-browser/screen-capture`: record, edit and export screen videos | https://in-browser.org/screen-capture |
| `packages/brand` | `@in-browser/brand`: header, footer, theme, language logic, PWA, toasts, dialogs, context menu | – |
| `packages/files` | `@in-browser/files`: shared file system (OPFS) with connected sources (`/:c/<id>`: folders on disk, WebDAV, S3), live access to other devices, guest shares (synced into the guest's browser), media in pieces, file dialog, formats, folder and device sync | – |
| `packages/ink` | `@in-browser/ink`: ink core of the drawing tools – strokes, shapes and pictures on pages, pen math (pressure, smoothing, outlines, shape recognition, snapping) | – |
| `packages/pdf` | `@in-browser/pdf`: PDF.js and pdf-lib loaded on demand, PDF pages rendered in blocks for tiles, changes written as incremental updates, form scripts in a QuickJS sandbox | – |
| `packages/graphics` | `@in-browser/graphics`: colors, icons, shapes and fields of the drawing tools | – |
| `packages/jwl` | `@in-browser/jwl`: writes JW Library playlists (`.jwlplaylist`) of pictures and videos – the database with sql.js in a worker, streamed as a ZIP | – |
| `packages/p2p-node` | `@in-browser/p2p-node`: always-on device for the device sync, runs in Node ([README](packages/p2p-node/README.md), [user guide](https://in-browser.org/help/p2p-node)) | https://in-browser.org/p2p-node/install.sh |

Each tool is its own npm workspace package with its logic, components and texts; the app only has a few route
files per tool (`src/routes/<tool>/`). Tools never import from each other – shared code lives in `packages/` and is
consumed as source.

User help is on the site, not here: https://in-browser.org/help (pages in `src/routes/help/`, texts of the suite in
`src/lib/i18n/help.*.ts`, each tool's in its `src/i18n/help.*.ts`, also shown in the tool's help window).

Your devices sync their files directly with each other over WebRTC; only encrypted connection offers pass through
public Nostr relays. Both syncs (devices and a folder on disk) share one way of applying changes
(`packages/files/src/sync/apply.ts`): the newer version wins, the other one becomes a conflict copy, and what the user
deletes goes into the synced trash `/.in-browser-trash/` (`packages/files/src/trash.ts`). Folders a device doesn't
sync open live from a device that has them (live requests on the same connections, `packages/files/src/p2p/live.ts`).
A guest share gives one folder or file to a browser outside the group (by link, QR code or four words): the guest
gets a copy kept in sync by the same sessions (`packages/files/src/p2p/session.ts`, `share-tree.ts`) and deleted
when the share ends. How this looks to users:
https://in-browser.org/help/sync and https://in-browser.org/help/connected.

Stack: SvelteKit with Svelte 5 (runes), Tailwind CSS 4 + daisyUI 5, TypeScript, Vitest, Playwright. The UI is
available in English and German (following the browser language).

## Development

```sh
npm install         # once (Node 26, see .node-version)
npm run dev         # overview and all tools (http://localhost:5173)
npm run check       # type check
npm test            # unit tests (Node) and browser tests (headless Chromium)
npm run build       # static build into build/ (scripts/csp.ts then allows the pages' inline scripts by hash in
                    # build/_headers), plus the p2p-node into build/p2p-node/
npm run test:e2e    # build, then end-to-end tests against the local Worker
npm run icons       # rewrite favicons and app icons from packages/brand/src/tool-icons.ts
```

Browser tests and end-to-end tests need Chromium for Playwright once:

```sh
npx playwright install chromium
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

Deploying needs the p2p-node release key, otherwise it stops before uploading (see
[packages/p2p-node](packages/p2p-node/README.md#development)). Header rules (CSP, Permissions-Policy per tool,
caching) are in `static/_headers`. The footer of the overview shows the commit the site was built from.

## How this was built

in-browser is a co-work of Benjamin and Claude as an AI pair programmer: ideas, decisions
and testing by Benjamin, much of the implementation written together with Claude.

## License

[MIT](LICENSE). Bundled third-party software and its licenses are listed in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
