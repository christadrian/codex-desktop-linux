### Agent Workspaces Settings Page

File: /home/christadrian/Projects/codex-desktop-setup/linux-features/agent-workspace/patch.js
Last updated: 2026-07-08

| Property         | Class                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Background       | bg-transparent                                                        |
| Border           | border border-token-border-light                                      |
| Border radius    | rounded-lg                                                            |
| Text — primary   | text-token-text-primary                                               |
| Text — secondary | text-token-text-secondary                                             |
| Spacing          | p-4, gap-4, gap-2                                                     |
| Hover state      | hover:bg-token-bg-secondary                                           |
| Shadow           | none                                                                  |
| Accent usage     | text-token-text-primary for active labels, token borders for grouping |

**Pattern notes:**
Generated Linux settings pages should reuse upstream token classes, rounded cards, light token borders, and compact 4/2 spacing. Avoid feature-specific colors so optional settings blend into the native Codex settings surface.
