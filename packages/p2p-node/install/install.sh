#!/bin/sh
# Installs the in-browser p2p-node for this user (Linux, macOS):
#   curl -fsSL __ORIGIN__/p2p-node/install.sh | sh
# Puts the starter into ~/.local/share/in-browser-p2p-node and the command in-browser-p2p-node into ~/.local/bin.
# The starter then loads the sync process from the site itself (signed) and keeps it up to date.
set -eu

ORIGIN="${IN_BROWSER_ORIGIN:-__ORIGIN__}"
DATA="${IN_BROWSER_P2P_NODE_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/in-browser-p2p-node}"
BIN="${IN_BROWSER_P2P_NODE_BIN:-$HOME/.local/bin}"

if ! command -v node >/dev/null 2>&1; then
	echo "Node.js 26 or newer is needed (https://nodejs.org)." >&2
	exit 1
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 26 ]; then
	echo "Node.js 26 or newer is needed (this is $(node --version))." >&2
	exit 1
fi

# The real path: version managers (fnm, nvm) put a per-shell link first in PATH that is gone after a restart
NODE="$(node -p process.execPath)"

mkdir -p "$DATA" "$BIN"
chmod 700 "$DATA"
curl -fsSL "$ORIGIN/p2p-node/starter.js" -o "$DATA/starter.js.tmp"
mv "$DATA/starter.js.tmp" "$DATA/starter.js"
printf '{"origin":"%s"}\n' "$ORIGIN" > "$DATA/config.json"
cat > "$BIN/in-browser-p2p-node" <<SCRIPT
#!/bin/sh
exec "$NODE" "$DATA/starter.js" "\$@"
SCRIPT
chmod 755 "$BIN/in-browser-p2p-node"
"$BIN/in-browser-p2p-node" update

echo
echo "Installed. Next: in Files open the sync dialog, choose \"Add device\" and copy the link, then:"
echo "  in-browser-p2p-node pair home \"<link>\""
echo "  in-browser-p2p-node install home"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "(Add $BIN to your PATH, or call $BIN/in-browser-p2p-node.)" ;; esac
