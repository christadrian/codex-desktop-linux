#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { applyLightSidebarCssPatch, descriptors } = require("./patch.js");

const MARKER = "/* codex-linux-light-sidebar-v2 */";

test("light sidebar CSS patch adds light-theme sidebar variables", () => {
  const fixture = ".electron-dark{color-scheme:dark}.electron-light{color-scheme:light}";
  const result = applyLightSidebarCssPatch(fixture);

  assert.ok(result.startsWith(fixture));
  assert.match(result, new RegExp(MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(result, /@media \(prefers-color-scheme: light\)/);
  assert.match(result, /\[data-codex-window-type="electron"\]\.electron-light/);
  assert.doesNotMatch(result, /\[data-codex-window-type="electron"\]\.electron-dark/);
  assert.match(result, /--color-token-side-bar-background: var\(--gray-50\)/);
  assert.match(result, /--vscode-sideBar-background: var\(--gray-50\)/);
  assert.match(result, /\.app-shell-left-panel/);
});

test("light sidebar CSS patch is idempotent", () => {
  const fixture = `body{color:red}\n${MARKER}\n`;
  assert.equal(applyLightSidebarCssPatch(fixture), fixture);
});

test("light sidebar descriptor targets current app CSS bundle names", () => {
  const { pattern } = descriptors[0];

  assert.match("app-D6IMMkHW.css", pattern);
  assert.match("app-main-C8zHCT66.css", pattern);
  assert.doesNotMatch("apple-D6IMMkHW.css", pattern);
});
