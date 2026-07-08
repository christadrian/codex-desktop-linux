### Agent Workspace Settings Page

File: linux-features/agent-workspace/patch.js
Last updated: 2026-07-08

| Property         | Class                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Background       | bg-token-bg-primary, bg-token-main-surface-secondary                  |
| Border           | border border-token-border-default                                    |
| Border radius    | rounded-md                                                            |
| Text — primary   | text-token-text-primary, text-xl font-semibold                        |
| Text — secondary | text-token-text-secondary, text-sm                                    |
| Spacing          | gap-6 px-4 py-6, gap-3 p-3                                           |
| Hover state      | hover:bg-token-main-surface-secondary                                 |
| Shadow           | shadow-sm                                                             |
| Accent usage     | border-yellow-500/40, text-yellow-700 dark:text-yellow-300 for warnings |

**Pattern notes:**
Generated settings panels use upstream Codex token classes, `rounded-md` cards/buttons, neutral token borders, and yellow token-compatible warning accents. Future Linux feature settings pages should match these token classes instead of hardcoded colors.
