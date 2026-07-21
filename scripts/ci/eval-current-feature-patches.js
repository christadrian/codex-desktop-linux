#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_PATCHES = [
  "linux-about-dialog",
  "linux-avatar-settings-sync",
  "linux-chrome-extension-status",
  "linux-app-updater-bridge",
  "linux-chrome-plugin-auto-install",
  "browser-use-node-repl-approval",
  "linux-browser-use-webview-attach-recovery",
  "linux-tooltip-window-controls-collision",
  "local-environment-action-modal-draft",
  "keybinds-settings",
  "feature:authenticated-proxy:main-process-proxy-auth",
  "feature:appshots:linux-appshots-availability",
  "feature:appshots:linux-appshots-settings-hotkey",
  "feature:open-target-discovery:main-bundle-open-target-discovery",
  "feature:frameless-titlebar:main-process",
  "feature:remote-control-ui:remote-connections-visibility",
  "feature:remote-control-ui:remote-control-connections-visibility",
  "feature:remote-control-ui:experimental-features",
  "feature:conversation-mode:dictation-endpoint",
  "feature:frameless-titlebar:webview-window-controls-layout",
  "feature:agent-workspace:settings-page",
  "feature:read-aloud:assistant-runtime",
  "feature:ui-tweaks:sidebar-project-name-style",
  "feature:custom-endpoint-marketplace:marketplace-hide-guard",
  "feature:remote-mobile-control:linux-remote-mobile-app-server-remote-control",
  "feature:remote-mobile-control:linux-remote-control-load-gate",
  "feature:remote-mobile-control:linux-remote-mobile-conversation-hydration",
  "feature:remote-mobile-control:linux-remote-control-status-read-guard",
  "feature:custom-endpoint-model-picker:main-bundle-catalog-models",
  "feature:custom-endpoint-model-picker:model-picker-allowlist",
  "feature:custom-endpoint-model-picker:composer-menu-models",
];
const PASSING_STATUSES = new Set(["applied", "already-applied"]);

function evaluateReport(report) {
  const entries = new Map((report.patches ?? []).map((entry) => [entry.name, entry]));
  const results = EXPECTED_PATCHES.map((name) => {
    const entry = entries.get(name);
    return { name, status: entry?.status ?? "missing", passed: PASSING_STATUSES.has(entry?.status) };
  });
  return { passed: results.filter((result) => result.passed).length, total: results.length, results };
}

function main(argv = process.argv.slice(2)) {
  const reportPath = path.resolve(argv[0] ?? "codex-app/.codex-linux/patch-report.json");
  const score = evaluateReport(JSON.parse(fs.readFileSync(reportPath, "utf8")));
  for (const result of score.results) {
    console.log(`${result.passed ? "PASS" : "FAIL"}\t${result.status}\t${result.name}`);
  }
  console.log(`feature patch drift eval: ${score.passed}/${score.total}`);
  if (score.passed !== score.total) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { EXPECTED_PATCHES, evaluateReport };
