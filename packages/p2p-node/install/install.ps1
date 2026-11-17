# Installs the in-browser p2p-node for this user (Windows):
#   irm __ORIGIN__/p2p-node/install.ps1 | iex
# Puts the starter into %LOCALAPPDATA%\in-browser-p2p-node and the command in-browser-p2p-node into the user's PATH.
# The starter then loads the sync process from the site itself (signed) and keeps it up to date.
$ErrorActionPreference = 'Stop'

$Origin = if ($env:IN_BROWSER_ORIGIN) { $env:IN_BROWSER_ORIGIN } else { '__ORIGIN__' }
$Data = if ($env:IN_BROWSER_P2P_NODE_HOME) { $env:IN_BROWSER_P2P_NODE_HOME } else { Join-Path $env:LOCALAPPDATA 'in-browser-p2p-node' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 26 or newer is needed (https://nodejs.org).' }
# The real path: version managers (fnm, nvm) put a per-shell link first in PATH that is gone after a restart
$Node = (& node -p process.execPath)
if ([int](& $Node -p 'process.versions.node.split(".")[0]') -lt 26) { throw "Node.js 26 or newer is needed (this is $(& $Node --version))." }

New-Item -ItemType Directory -Force -Path $Data | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri "$Origin/p2p-node/starter.js" -OutFile (Join-Path $Data 'starter.js.tmp')
Move-Item -Force (Join-Path $Data 'starter.js.tmp') (Join-Path $Data 'starter.js')
Set-Content -Encoding ascii -Path (Join-Path $Data 'config.json') -Value "{`"origin`":`"$Origin`"}"
Set-Content -Encoding ascii -Path (Join-Path $Data 'in-browser-p2p-node.cmd') -Value "@`"$Node`" `"$Data\starter.js`" %*"

$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (($UserPath -split ';') -contains $Data)) {
	[Environment]::SetEnvironmentVariable('Path', ($UserPath.TrimEnd(';') + ";$Data").TrimStart(';'), 'User')
	$env:Path += ";$Data"
}
& (Join-Path $Data 'in-browser-p2p-node.cmd') update

Write-Host ''
Write-Host 'Installed. Next: in Files open the sync dialog, choose "Add device" and copy the link, then:'
Write-Host '  in-browser-p2p-node pair home "<link>"'
Write-Host '  in-browser-p2p-node install home'
