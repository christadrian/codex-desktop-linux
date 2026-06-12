#!/usr/bin/env bash
# Enable light-sidebar, rebuild codex-app, and build a Debian package.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FEATURE_CONFIG="$REPO_ROOT/linux-features/features.json"

FEATURE_CONFIG="$FEATURE_CONFIG" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const configPath = process.env.FEATURE_CONFIG;
let config = { enabled: [] };
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
}
if (!Array.isArray(config.enabled)) {
  config.enabled = [];
}
if (!config.enabled.includes("light-sidebar")) {
  config.enabled.push("light-sidebar");
}
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
NODE

"$REPO_ROOT/install.sh" "$@"
"$REPO_ROOT/scripts/build-deb.sh"
