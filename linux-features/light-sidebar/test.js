#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { applyLightSidebarCssPatch } = require("./patch.js");

const MARKER = "/* codex-linux-light-sidebar-v2 */";

test("light sidebar CSS patch adds light-theme sidebar variables", () => {
  const fixture = ".electron-dark{color-scheme:dark}.electron-light{color-scheme:light}";
  const result = applyLightSidebarCssPatch(fixture);

  assert.ok(result.startsWith(fixture));
  assert.match(result, new RegExp(MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result, /@media \(prefers-color-scheme: light\)/);
  assert.match(result, /--color-token-side-bar-background: var\(--gray-50\)/);
  assert.match(result, /--vscode-sideBar-background: var\(--gray-50\)/);
  assert.match(result, /\.app-shell-left-panel/);
});

test("light sidebar CSS patch is idempotent", () => {
  const fixture = `body{color:red}\n${MARKER}\n`;
  assert.equal(applyLightSidebarCssPatch(fixture), fixture);
});
