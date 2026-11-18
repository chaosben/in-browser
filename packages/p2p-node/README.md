# p2p-node

An always-on device for the device sync of [in-browser](https://in-browser.org): a small Node process for a computer
or home server that joins the user's devices like a browser and keeps the files in an ordinary folder on disk.

**Installing and using it:** see the guide on the site, https://in-browser.org/help/p2p-node (install, pairing,
commands, port forwarding, updates and security). Its texts live in `src/lib/i18n/help.*.ts` of the app (`p2pNode`) –
keep them in step with the commands and behaviour here.

## Development

The package is consumed as source like the others, but Node can't run it that way: `npm run build` bundles it
(`scripts/build.ts`) into `build/p2p-node/`, which the site serves under `/p2p-node/`.

- `src/peer.ts`: the sync process: `Device` from `@in-browser/files` with a folder (`tree.ts`), JSON state
  (`store.ts`) and Trystero with [werift](https://github.com/shinyoshiaki/werift-webrtc) as WebRTC (pure JavaScript, no
  native modules); `upnp.ts` keeps its fixed UDP range forwarded by the router.
- `src/starter.ts`: instances, updates (`updates.ts`), service setup (`service.ts`), sandbox (`sandbox.ts`).
- `src/release.ts`: manifest and signature. The private release key is never in the repository. The build reads it
  from `P2P_NODE_SIGNING_KEY` or `~/.config/in-browser/p2p-node-signing-key.json`. Without it the build is
  unsigned: fine for tests, but nodes refuse it and `npm run deploy` stops.

Tests: Node specs next to the modules, and `e2e/p2p-node.e2e.ts`, which runs the built sync process in its sandbox
together with two browsers.
