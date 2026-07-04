#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_PATCHES = [
  "feature:authenticated-proxy:main-process-proxy-auth",
  "feature:appshots:linux-appshots-availability",
  "feature:appshots:linux-appshots-settings-hotkey",
  "feature:remote-control-ui:remote-connections-visibility",
  "feature:remote-control-ui:remote-control-connections-visibility",
  "feature:remote-control-ui:experimental-features",
  "feature:remote-control-ui:nux-gate",
  "feature:conversation-mode:dictation-endpoint",
  "feature:frameless-titlebar:webview-window-controls-layout",
  "feature:agent-workspace:settings-page",
  "feature:remote-mobile-control:linux-remote-control-load-gate",
  "feature:remote-mobile-control:linux-remote-mobile-conversation-hydration",
  "feature:remote-mobile-control:linux-remote-control-status-read-guard",
  "feature:custom-endpoint-model-picker:main-bundle-catalog-models",
  "feature:custom-endpoint-model-picker:model-picker-allowlist",
  "feature:custom-endpoint-model-picker:sidebar-provider-filter",
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
