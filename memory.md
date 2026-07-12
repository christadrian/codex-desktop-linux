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
