# Memory — Upstream Drift and Custom Endpoint ChatGPT Surfaces

Last updated: 2026-07-11 19:58:36 EAT

## What was built

- Repaired current upstream bundle drift across core and enabled Linux feature patches.
- Extended `linux-features/chatgpt-dual-backend/` so Chat history, Sites, and Send to cloud use the saved ChatGPT session while ordinary Codex traffic stays on the custom endpoint.
- Fixed Sites cross-chunk state through `globalThis.__codexLinuxChatGptBackendSession`.
- Promoted `custom-endpoint-marketplace` from ignored local state to a repository feature and fixed its descriptor to patch the current shared plugins hook chunk.
- Added or refreshed deterministic tests and evals for every repaired feature.
- Rebuilt `codex-app` successfully.

## Decisions made

- OpenAI account surfaces use the saved ChatGPT token, never a cached custom-provider token.
- Custom endpoints continue handling normal Codex task traffic.
- Marketplace visibility is fixed at the shared plugin hook, not per page.
- Current upstream shapes only. Old drift fallbacks were removed.

## Problems solved

- Chat history disappeared after switching back to the official endpoint.
- Sites and Send to cloud were hidden or blocked while a custom endpoint was active.
- Public, personal, and ChatGPT-connected plugins were hidden because the marketplace patch descriptor missed the current shared Vite chunk.
- Twenty-three optional patches missed current upstream asset names or needles.

## Current state

- Portable build: `/home/christadrian/Projects/codex-desktop-setup/codex-app/start.sh`.
- Sites was verified working by Christadrian.
- Marketplace patch report: applied.
- Patch report: zero skipped optional patches, zero failed required patches, zero integrity findings.
- Marketplace feature tests: 8/8. Marketplace evals: 2/2.
- Plugin UI still needs Christadrian's final live verification against the rebuilt portable app.
- Protected untracked directories remain untouched:
  - `.titlebar-package.ItYFs9/`
  - `.upstream-browser-use-validated.l1q46E/`

## Next session starts with

1. Run `/remember restore`.
2. Launch `/home/christadrian/Projects/codex-desktop-setup/codex-app/start.sh`.
3. Switch to the custom endpoint.
4. Verify Plugins shows public, personal, and ChatGPT-connected entries.
5. If verified, install the native package and restart Codex Desktop.

## Open questions

- Does the rebuilt portable Plugins page now match the official-endpoint inventory?
