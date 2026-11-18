# p2p-node

Your devices sync their files directly with each other (Files → Sync), but only while at least two of them have
in-browser open. The p2p-node is an always-on device for a computer or home server: a small Node process that joins
your devices like a browser and keeps the files in an ordinary folder on disk. Changes then reach your other
devices even when they are never online at the same time, and you can work in that folder with any program.

## Install

Needs Node.js 26 or newer.

```sh
# Linux, macOS
curl -fsSL https://in-browser.org/p2p-node/install.sh | sh
```

```powershell
# Windows (PowerShell)
irm https://in-browser.org/p2p-node/install.ps1 | iex
```

This installs the starter for your user only (`~/.local/share/in-browser-p2p-node`, on Windows
`%LOCALAPPDATA%\in-browser-p2p-node`) and the command `in-browser-p2p-node`. No root or admin rights are needed.

## Use

In Files open the sync dialog, choose “Add device” and copy the link. Then:

```sh
in-browser-p2p-node pair home "<link>"     # add this computer as a device named after it
in-browser-p2p-node install home           # keep it running in the background
```

| Command | |
| --- | --- |
| `pair <name> <link> [--folder <dir>] [--name <device name>]` | Add a new instance as a device. The synced folder defaults to `<data>/instances/<name>/files`. |
| `run <name>` | Run an instance in the foreground. |
| `install <name>` / `uninstall <name>` | Run it in the background: a systemd user service (`in-browser-p2p-node@<name>`) or a Windows task at logon. `uninstall` keeps the data. |
| `status [<name>]` | Devices and folder of one or all instances. |
| `update` | Look for a new version now. |

Each instance is a device of its own with its own folder, so one server can keep the files of several people
(`pair anna …`, `pair ben …`).

On Linux, a user service stops when you log out unless you allow it to linger: `loginctl enable-linger $USER`.
Logs: `journalctl --user -u in-browser-p2p-node@home -f`, and `<data>/instances/<name>/node.log`.

To remove the computer from your devices, remove it in Files; the instance then stops by itself.

The trash of your devices is the hidden folder `.in-browser-trash/` inside the synced folder: what you delete in
Files (or a notebook or project in its tool) lands there on every device, one folder per deleted item with a
`.trashinfo.json`. The node removes entries after the retention chosen in Files (the setting syncs too); `status`
shows its size. Files you delete in the folder yourself are synced as deletions – your system's trash keeps them.

## Reaching the node from outside your home network

Devices connect directly to each other, without a relay server. Inside your home network that always works. From
outside (a phone on mobile data, a laptop on hotel Wi-Fi) the connection only gets through your router if the node can
be reached there:

- The node always uses the **UDP ports 29400–29449** and asks your router to forward them (UPnP). The log shows the
  outcome: `Router: UDP 29400-29449 forwarded to 192.168.178.20 via UPnP (public 203.0.113.7) – if this computer has a
  firewall, allow UDP 29400-29449 there too`.
- **FRITZ!Box:** under Home Network → Network, open this computer and check “Permit independent port sharing”. Other
  routers: turn on UPnP (port forwarding by devices).
- Without UPnP, forward UDP 29400–29449 to this computer by hand; the log names its address. If the computer has a
  firewall of its own, allow the range there too (e.g. `sudo ufw allow 29400:29449/udp`).
- This needs a public IPv4 address at home. Behind DS-Lite or carrier-grade NAT, forwarding can't help (the log says
  so); devices with IPv6 on both ends may still connect.
- `IN_BROWSER_ICE_PORTS=off` in the environment of the service turns this off (random ports, no forwarding).

To see why a device doesn't connect, set `IN_BROWSER_DEBUG=1` (`systemctl --user edit in-browser-p2p-node@home`,
`[Service]` `Environment=IN_BROWSER_DEBUG=1`) and watch the log for `peer.unreachable`.

## Updates and security

The starter loads the sync process from the site and keeps it up to date: it looks for a new version every hour,
and right away when another device runs a newer protocol. It switches between two syncs.

- **Signed:** a version is only taken with a valid Ed25519 signature of the release key, and every file only with its
  signed checksum. Whoever controls the hosting alone can't run code on your computer. The installer itself is
  trusted on first use, like any `curl … | sh`.
- **Sandboxed:** the sync process runs in Node's permission model. It can only read and write its own state and the
  synced folder, plus use the network. Node disables `fsync` there, so writes rely on the file system's own ordering
  (state files and received files are still written to a temporary name first and renamed into place).
- **Router:** the node only forwards its own UDP range (29400–29449) to itself, for an hour at a time and renewed
  while it runs; routers that don't take a lease keep it until removed there.
- **Fallback:** if a new version keeps crashing, the node goes back to the previous one and skips the broken one.
- Files are stored unencrypted in the folder, like any other file on that computer. Use the disk encryption of your
  system if needed.

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
