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

## Structure

This package holds the whole tool (`src/`: logic, components, texts, pages). The app serves it under
**https://in-browser.de/screen-capture** with thin route files in `src/routes/screen-capture/` of the repository;
development, tests and deployment run from the repository root, see the [root README](../../README.md).

`npm run icons -w tools/screen-capture` regenerates the curated icon lists from `scripts/icons.mjs`.
