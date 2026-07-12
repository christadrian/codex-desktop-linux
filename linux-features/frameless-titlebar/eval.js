#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyFramelessTitlebarMainPatch, descriptors } = require("./patch.js");
const descriptor = descriptors.find(({ id }) => id === "webview-window-controls-layout");
assert(
  descriptor.pattern.test(
    "app-initial~app-main~new-thread-panel-page~appgen-library-page~hotkey-window-thread-page~ho~iufn7mg3-k1satKyX.js",
  ),
);
const source = "case`quickChat`:case`primary`:return n===`darwin`?{titleBarStyle:`hiddenInset`,trafficLightPosition:A9(r),...e===`quickChat`?{hasShadow:!0,resizable:!0,transparent:!0}:{},...t?{}:{vibrancy:`menu`}}:n===`win32`||n===`linux`?{titleBarStyle:`hidden`,titleBarOverlay:n===`linux`?codexLinuxTitleBarOverlay(r):j9(r),...e===`quickChat`?{resizable:!0}:{}}:{titleBarStyle:`default`,...e===`quickChat`?{resizable:!0}:{}};";
const patched = applyFramelessTitlebarMainPatch(source);
assert.match(patched, /n===`linux`\?\{titleBarStyle:`hidden`/);
assert.doesNotMatch(patched, /n===`win32`\|\|n===`linux`/);
console.log("3/3 frameless-titlebar eval scenarios passed");
