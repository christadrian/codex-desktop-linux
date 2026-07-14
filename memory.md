# Memory — Browser Use node_repl Transport Fix

Last updated: 2026-07-12 17:50 EAT

## What was built

- Removed the `mcp-helper-reaper` wrapper around `resources/node_repl`.
- Kept the feature's cold-start, after-exit, and SessionStart scan hooks.
- Added upgrade restoration for installs still carrying the legacy wrapper.
- Added regression tests, an eval, and updated feature documentation.

## Decisions made

- `node_repl` launches must not trigger same-parent helper deduplication.
- Multiple Browser Use sessions under one Codex backend are valid concurrent helpers.
- Orphan cleanup remains enabled through scan hooks.

## Problems solved

- Starting another Browser Use helper could reap an active `node_repl`, closing its stdio transport and producing `Transport closed`.

## Current state

- Targeted tests: 6/6 passed.
- Rust reaper tests: 24/24 passed.
- All Linux feature tests passed.
- New eval: 3/3 passed.
- Full feature eval sweep has one unrelated existing failure in `linux-features/agent-workspace/eval.js`.
- Source fix still needs commit, push, rebuild, install, and live Browser Use verification.
- Protected untracked directories remain untouched:
  - `.titlebar-package.ItYFs9/`
  - `.upstream-browser-use-validated.l1q46E/`

## Next session starts with

1. Run `/remember restore`.
2. Rebuild/install the package containing the fix.
3. Restart Codex Desktop.
4. Run two Browser Use tasks concurrently and verify both `node_repl/js` transports stay alive.

## Open questions

- Does live concurrent Browser Use verification remain stable after reinstall?

# Memory — Current Upstream DMG Patch Refresh

Last updated: 2026-07-12

## What changed

- Routed core and optional webview patches to the current consolidated upstream bundle.
- Refreshed AppShots, open-target, frameless titlebar, remote-control, API-key tier, Copilot effort, and model-picker patch fixtures.
- Removed the obsolete dynamic reasoning-effort patch because upstream now supplies the current GPT-5.6 effort set.
- Removed the deleted remote-control NUX descriptor from the current-patch eval.

## Evidence

- Core patch tests: 346/346 passed.
- Linux feature tests: 531/531 passed.
- Changed feature evals passed.
- Current DMG patch probe: 28/28 expected patches passed; only four explicitly disabled Computer Use descriptors skipped.
- `git diff --check` passed.

## Next session starts with

1. Rebuild and install with `make install-native`.
2. Restart Codex Desktop.
3. Verify Browser Use plus enabled optional features against the rebuilt package.

# Memory — ChatGPT Dual Backend Custom Endpoint Fix

Last updated: 2026-07-14

## What changed

- Routed ChatGPT entitlement patching through all current `app-initial~*app-main~*` chunks, including the current Quick Chat shared chunk.
- Made Sites access deterministic for valid saved ChatGPT sessions instead of relying on cross-chunk global initialization order.
- Added current-upstream regression tests and eval coverage.

## Evidence

- `node --test linux-features/chatgpt-dual-backend/test.js`: 11/11 passed.
- `node linux-features/chatgpt-dual-backend/eval.js`: 10/10 passed.
- Latest extracted upstream gates: 3/3 patched.
- `git diff --check`: passed.

## Handoff

- Do not build in this session unless explicitly requested.
- Rebuild/install manually with `./install.sh ./Codex.dmg`.
- Restart Codex Desktop after install.
- Protected untracked directories remain untouched:
  - `.titlebar-package.ItYFs9/`
  - `.upstream-browser-use-validated.l1q46E/`
