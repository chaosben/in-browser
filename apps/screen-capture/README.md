# Screen Capture · in-browser.de

Record your screen (optionally with webcam and microphone), edit it with annotations, text, still frames, pan & zoom
and multiple video and audio tracks, and export it as MP4 – entirely in the browser, without a server. Part of the
[in-browser.de](https://in-browser.de) tool family.

- Current desktop browsers (needs WebCodecs, OPFS and screen sharing); works best in Chrome/Edge. In Firefox there
  is no "save as folder" (File System Access), no installation as an app and no system audio; depending on the
  system, the export uses Opus/VP9 instead of AAC/H.264.
- Projects are stored in browser storage (OPFS), optionally as a folder on disk
- Installable as a PWA and usable offline
- Media handling (recording, import, decoding, export) is based on [Mediabunny](https://mediabunny.dev)

## Development

From the monorepo root, see the [root README](../../README.md).

## Deployment

Static SPA on Cloudflare Workers (static assets) at **https://screen-capture.in-browser.de** – configuration in
`wrangler.jsonc`, header rules (CSP, Permissions-Policy, caching) in `static/_headers`.

Prerequisites: the zone `in-browser.de` is in the Cloudflare account and there is no CNAME record for
`screen-capture` yet (the first deployment creates the custom domain including DNS record and certificate). There is
deliberately no `*.workers.dev` address.

Commands (login, dry run, deploy) are in the [root README](../../README.md#deployment), e.g.
`npm run deploy:check -w apps/screen-capture`.
