#!/usr/bin/env bash
# Apply/update light sidebar CSS patch to an already installed Codex Desktop app.
# Durable rebuilds should enable linux-features/light-sidebar instead.
set -euo pipefail

APP_DIR="${CODEX_DESKTOP_APP_DIR:-/opt/codex-desktop}"
ASSETS_DIR="$APP_DIR/content/webview/assets"
OLD_MARKER="/* codex-linux-light-sidebar */"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_MODULE="$SCRIPT_DIR/../linux-features/light-sidebar/patch.js"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root (sudo)." >&2
  exit 1
fi

if [ ! -d "$ASSETS_DIR" ]; then
  echo "ERROR: Webview assets directory not found at $ASSETS_DIR" >&2
  exit 1
fi

CSS_TARGET="$(find "$ASSETS_DIR" -maxdepth 1 -type f -name 'app--*.css' | sort | head -n 1)"
if [ -z "$CSS_TARGET" ]; then
  echo "ERROR: No app--*.css bundle found in $ASSETS_DIR" >&2
  exit 1
fi

BACKUP="$CSS_TARGET.bak-$(date +%Y%m%d-%H%M%S)"
cp "$CSS_TARGET" "$BACKUP"
echo "Backed up to $BACKUP"

CSS_TARGET="$CSS_TARGET" OLD_MARKER="$OLD_MARKER" PATCH_MODULE="$PATCH_MODULE" node <<'NODE'
const fs = require("node:fs");
const target = process.env.CSS_TARGET;
const oldMarker = process.env.OLD_MARKER;
const { applyLightSidebarCssPatch } = require(process.env.PATCH_MODULE);

let source = fs.readFileSync(target, "utf8");
const oldMarkerIndex = source.indexOf(oldMarker);
if (oldMarkerIndex !== -1) {
  source = source.slice(0, oldMarkerIndex);
}

const patched = applyLightSidebarCssPatch(source);
if (patched !== fs.readFileSync(target, "utf8")) {
  fs.writeFileSync(target, patched, "utf8");
  console.log("Light sidebar patch applied.");
} else {
  console.log("Light sidebar patch already present.");
}
NODE

echo "Restart Codex Desktop for changes to take effect."
