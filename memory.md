# Memory — Light Sidebar Linux Feature

Last updated: 2026-06-12 03:54:08 EAT

## What was built

- Added opt-in Linux feature `light-sidebar` under `linux-features/light-sidebar/`.
- Created `linux-features/light-sidebar/patch.js` with a `webview-asset` descriptor that patches hashed `app--*.css` bundles during `install.sh`/package builds.
- Created `linux-features/light-sidebar/test.js` covering CSS rule insertion and idempotency.
- Created `linux-features/light-sidebar/README.md` with Arch-focused build/install instructions.
- Added `scripts/apply-light-sidebar.sh` as an emergency installed-app hotpatch helper for `/opt/codex-desktop`.
- Added `scripts/build-light-sidebar-deb.sh` and `scripts/build-light-sidebar-pacman.sh`; the pacman helper is the relevant one for Christadrian's Arch machine.
- Updated `docs/build-and-packaging.md` to install Arch packages via `dist/codex-desktop-latest.pkg.tar.zst` instead of a wildcard.

## Decisions made

- Durable fix lives in the Linux feature patch pipeline, not direct edits to `/opt/codex-desktop/content/webview/assets/*.css`.
- `light-sidebar` remains opt-in and disabled by default in tracked config, consistent with repository feature rules.
- Local `linux-features/features.json` is gitignored and was created/enabled locally with `light-sidebar` so manual builds apply the patch.
- Arch install should use `make pacman`/`build-pacman.sh` and `sudo pacman -U dist/codex-desktop-latest.pkg.tar.zst`, not Debian `.deb` flow.

## Problems solved

- Earlier one-off script patched installed CSS directly; Codex updates overwrote it. The new feature is reapplied during rebuild/update packaging.
- `./install.sh ./Codex.dmg` failed because no local `Codex.dmg` existed; corrected instructions to use `./install.sh` or `make build-app` unless a real DMG path is provided.
- `sudo pacman -U dist/codex-desktop-*.pkg.tar.zst` failed with `duplicate target` because the glob matched both the real package and `codex-desktop-latest.pkg.tar.zst` symlink. Docs now use the stable symlink path directly.
- Commit signing failed once due 1Password (`failed to fill whole buffer`); first commit was made unsigned with hooks still enabled. Later commits succeeded normally.

## Current state

- Branch `main` is clean and pushed to `origin/main`.
- Latest pushed commits:
  - `fb5b2df Fix Arch pacman install docs`
  - `682dba3 Add light sidebar pacman build helper`
  - `9f97489 Fix light sidebar build instructions`
  - `c47d3ef Add light sidebar Linux feature`
- Christadrian built pacman package successfully at `dist/codex-desktop-2026.06.12.004759-1-x86_64.pkg.tar.zst`.
- `dist/codex-desktop-latest.pkg.tar.zst` points to that package.
- Install command to use now: `sudo pacman -U dist/codex-desktop-latest.pkg.tar.zst`.
- Verification run during session:
  - `node --test linux-features/light-sidebar/test.js` passed 2/2.
  - `node --test scripts/patch-linux-window-ui.test.js` passed 221/221.
  - `node --test linux-features/*/test.js` passed 266/266.
  - shell syntax checks passed for helper scripts.

## Next session starts with

Run:

```bash
cd /home/christadrian/Projects/codex-desktop-fork
sudo pacman -U dist/codex-desktop-latest.pkg.tar.zst
```

Then fully quit and relaunch Codex Desktop. If the sidebar is still dark in light mode, inspect the installed CSS for `codex-linux-light-sidebar-v2` and verify the app is using light/system appearance.

## Open questions

- Need visual confirmation after installing and restarting that the sidebar is light in Codex light mode.
- If the patch applies but UI remains dark, the CSS selectors/variables may need updating against the current upstream webview bundle.
