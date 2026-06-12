# Memory - Light Sidebar Dark Mode Fix

Last updated: 2026-06-12 04:08:19 EAT

## What was built

- Fixed `linux-features/light-sidebar/patch.js` so the light sidebar CSS is scoped to `[data-codex-window-type="electron"].electron-light` instead of `@media (prefers-color-scheme: light)`.
- Updated the light-sidebar descriptor pattern to match current upstream CSS bundles: `app-*.css` and `app-main-*.css`.
- Updated `linux-features/light-sidebar/test.js` with regressions for dark-mode scope and current bundle names.
- Regenerated local `codex-app/` with `./install.sh ./Codex.dmg`; generated CSS now contains `codex-linux-light-sidebar-v2` in current app CSS bundles with `.electron-light` selectors.
- Committed and pushed `8b30566 Fix light sidebar dark mode scope` to `origin/main`.

## Decisions made

- The light sidebar feature should follow Codex app theme classes, not OS color-scheme media queries. This prevents a light OS theme from forcing light sidebar/titlebar-adjacent CSS while Codex itself is in dark mode.
- The durable fix remains in the opt-in Linux feature patch pipeline, not direct edits to generated installed CSS.
- Christadrian will build/package manually. No package artifact was built after the source fix.

## Problems solved

- The dark-mode screenshot issue was caused by the light-sidebar CSS applying under `prefers-color-scheme: light`, which can be true when Codex is manually set to dark mode.
- `light-sidebar` was also not applying during rebuild because the descriptor still targeted stale `app--*.css` names. Current bundles are named like `app-D6IMMkHW.css`, `app-main-C8zHCT66.css`, and `app-shell-DJDX7Pvr.css`.

## Current state

- Branch `main` is pushed to `origin/main` at `8b30566`.
- Working tree should be clean except generated/ignored build output from `codex-app/` regeneration.
- Verification completed:
  - `node --test linux-features/light-sidebar/test.js` passed 3/3.
  - `node --test scripts/patch-linux-window-ui.test.js` passed 221/221.
  - `node --test linux-features/*/test.js` passed 267/267.
  - `./install.sh ./Codex.dmg` completed and generated CSS marker verification passed.

## Next session starts with

Christadrian can build manually, likely:

```bash
cd /home/christadrian/Projects/codex-desktop-fork
./scripts/build-pacman.sh
sudo pacman -U dist/codex-desktop-latest.pkg.tar.zst
```

Then fully quit and relaunch Codex Desktop. Confirm light mode still has a light sidebar, and dark mode no longer shows the light strip from the screenshot.

## Open questions

- Need visual confirmation after manual package install and app restart.
