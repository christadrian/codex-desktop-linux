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

### 9Router Chat Panel

File: linux-features/chatgpt-dual-backend/patch.js
Last updated: 2026-07-10

| Property         | Class |
| ---------------- | ----- |
| Background       | `var(--token-main-surface-background)` |
| Border           | `1px solid var(--token-border)` |
| Border radius    | `6px` controls, `8px` button/message cards |
| Text — primary   | `var(--token-text-primary)` |
| Text — secondary | `var(--token-text-secondary)` |
| Spacing          | `7px` controls, `8px` history/message cards, `12px` header/composer |
| Hover state      | `background: var(--token-list-hover-background)` |
| Shadow           | none |
| Accent usage     | `var(--token-error-foreground)` for request failures |

**Pattern notes:**
Injected DOM cannot use upstream React token classes. Use existing CSS variables,
neutral token borders, and transparent controls. Keep 9Router visually separate
from ChatGPT without inventing a brand color.

### Sidebar Project Name

File: linux-features/ui-tweaks/patches/sidebar-project-name.js
Last updated: 2026-07-10

| Property         | Class |
| ---------------- | ----- |
| Background       | inherited |
| Border           | none |
| Border radius    | inherited |
| Text — primary   | `.text-fade-truncate.pr-1`, `font-weight: 700` |
| Text — secondary | inherited |
| Spacing          | `padding-top: 0.25rem` |
| Hover state      | inherited from `.group/folder-row` |
| Shadow           | none |
| Accent usage     | none |

**Pattern notes:**
Project-name tweaks stay scoped beneath `.group/folder-row` and preserve
upstream truncation, colors, and interaction states.
