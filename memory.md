# Memory — Main Sync and Current DMG Patch Refresh

Last updated: 2026-07-14 EAT

## What was built

- Merged the current `main` branch into `work` without rebasing, retaining all existing work-branch commits.
- Refreshed current-upstream patch targeting for:
  - `linux-features/pet-overlay/`
  - `linux-features/remote-control-ui/`
  - `linux-features/api-key-service-tier/`
  - `linux-features/conversation-mode/`
  - `linux-features/copilot-reasoning-effort/`
  - `linux-features/project-task-sort/`
  - `scripts/patches/core/all-linux/extracted-app/workspace-root-open-targets/`
- Added or refreshed regression tests, eval suites, and README validation commands for the affected optional features.
- Committed and pushed the completed merge to `origin/work`:
  - `a15eba8 Merge main updates and refresh current DMG patches`

## Decisions made

- Upstream patch drift targets only the latest supported `Codex.dmg`; no legacy bundle fallbacks were retained.
- The `work` branch was updated through a normal merge, never a rebase.
- Optional feature patches remain fail-soft and idempotent.
- Protected local directories remain untracked and untouched:
  - `.titlebar-package.ItYFs9/`
  - `.upstream-browser-use-validated.l1q46E/`

## Problems solved

- Fixed nine optional-patch warnings caused by current upstream bundle and minified-method drift.
- Updated Pet Overlay Niri drag completion wrapping to preserve the current docking tail.
- Updated webview bundle selectors for remote connections, API-key service tiers, dictation, Copilot reasoning effort, project task creation sorting, and workspace-root File Manager actions.

## Current state

- `work` and `origin/work` point to commit `a15eba8`.
- User confirmed the build and runtime behavior work.
- Patcher tests: 368/368 passed.
- Linux feature tests: 616/616 passed.
- Targeted warning regression tests: 154/154 passed.
- Feature eval suites: 18 passed.
- Script smoke tests passed.
- Updater tests: 242/242 passed.
- Cargo check, shell syntax checks, and `git diff --check` passed.
- No tracked changes remain after the pushed commit.
- No service restart is pending.

## Next session starts with

1. Run `/remember restore`.
2. Confirm `work` still matches `origin/work`.
3. Continue from commit `a15eba8`.

## Open questions

- None.
