"use strict";

const LIGHT_SIDEBAR_MARKER = "/* codex-linux-light-sidebar-v2 */";

function applyLightSidebarCssPatch(source) {
  if (source.includes(LIGHT_SIDEBAR_MARKER)) {
    return source;
  }

  const patch = [
    "",
    LIGHT_SIDEBAR_MARKER,
    "@media (prefers-color-scheme: light) {",
    "  [data-codex-window-type=\"electron\"] {",
    "    --color-background-surface: var(--gray-0);",
    "    --color-background-surface-under: var(--gray-50);",
    "    --color-background-elevated-secondary: var(--gray-100);",
    "    --color-background-elevated-secondary-opaque: var(--gray-100);",
    "    --color-token-bg-primary: var(--gray-50);",
    "    --color-token-main-surface-primary: var(--gray-0);",
    "    --color-token-side-bar-background: var(--gray-50);",
    "    --vscode-sideBar-background: var(--gray-50);",
    "    --color-text-foreground: #1a1c1f;",
    "    color-scheme: light;",
    "  }",
    "  [data-codex-window-type=\"electron\"] .bg-token-main-surface-primary,",
    "  [data-codex-window-type=\"electron\"] .bg-token-bg-primary,",
    "  [data-codex-window-type=\"electron\"] .bg-token-sidebar,",
    "  [data-codex-window-type=\"electron\"] [class*=\"bg-token-main-surface\"],",
    "  [data-codex-window-type=\"electron\"] .app-shell-left-panel {",
    "    background-color: var(--gray-50) !important;",
    "  }",
    "  [data-codex-window-type=\"electron\"] body {",
    "    background-color: var(--gray-50) !important;",
    "  }",
    "}",
    "",
  ].join("\n");

  return `${source}${patch}`;
}

const descriptors = [
  {
    id: "light-sidebar-css-v2",
    name: "light-sidebar-css-v2",
    phase: "webview-asset",
    order: 5000,
    ciPolicy: "optional",
    pattern: /^app--[a-zA-Z0-9_-]+\.css$/,
    missingDescription: "main app CSS bundle for light sidebar patch",
    skipDescription: "light sidebar CSS patch",
    apply: applyLightSidebarCssPatch,
  },
];

module.exports = {
  LIGHT_SIDEBAR_MARKER,
  applyLightSidebarCssPatch,
  descriptors,
};
