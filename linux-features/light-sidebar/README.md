# Light Sidebar

Opt-in CSS patch for Codex Desktop on Linux. It keeps the sidebar and left panel
light when the app is in light theme mode.

## Enable

Add the feature id to `linux-features/features.json`:

```json
{
  "enabled": [
    "light-sidebar"
  ]
}
```

Then rebuild the app or package from this repository. Without a DMG path,
`install.sh` downloads or reuses the cached upstream DMG automatically:

```bash
./install.sh
./scripts/build-deb.sh
```

If you already have a local DMG, pass its real path explicitly:

```bash
./install.sh /path/to/Codex.dmg
./scripts/build-deb.sh
```

For Debian-family packages, this helper enables the feature and runs the same
build flow:

```bash
./scripts/build-light-sidebar-deb.sh
```

Use the package builder matching your install format if you do not use Debian.

## Test

```bash
node --test linux-features/light-sidebar/test.js
```

The patch is applied during ASAR/webview asset patching, so future update
rebuilds keep it as long as `light-sidebar` stays enabled in the feature config.
