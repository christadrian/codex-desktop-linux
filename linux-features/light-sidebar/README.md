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

Then rebuild the app or package from this repository:

```bash
./install.sh ./Codex.dmg
./scripts/build-deb.sh
```

Use the package builder matching your install format if you do not use Debian.

## Test

```bash
node --test linux-features/light-sidebar/test.js
```

The patch is applied during ASAR/webview asset patching, so future update
rebuilds keep it as long as `light-sidebar` stays enabled in the feature config.
