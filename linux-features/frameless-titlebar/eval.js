#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyFramelessTitlebarMainPatch, descriptors } = require("./patch.js");
const descriptor = descriptors.find(({ id }) => id === "webview-window-controls-layout");
assert(
  descriptor.pattern.test(
    "app-initial~artifact-tab-content.electron~app-main~appgen-settings-page~page~pull-request-r~napudbu0-BLPFEZVT.js",
  ),
);
assert(
  descriptors.find(({ id }) => id === "webview-window-controls-chrome").pattern.test(
    "app-initial~app-main~onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~gwqc41kz-CnQKtQ6U.js",
  ),
);
const source = "case`quickChat`:case`primary`:return n===`darwin`?{titleBarStyle:`hiddenInset`,trafficLightPosition:A9(r),...e===`quickChat`?{hasShadow:!0,resizable:!0,transparent:!0}:{},...t?{}:{vibrancy:`menu`}}:n===`win32`||n===`linux`?{titleBarStyle:`hidden`,titleBarOverlay:n===`linux`?codexLinuxTitleBarOverlay(r):j9(r),...e===`quickChat`?{resizable:!0}:{}}:{titleBarStyle:`default`,...e===`quickChat`?{resizable:!0}:{}};";
const patched = applyFramelessTitlebarMainPatch(source);
assert.match(patched, /n===`linux`\?\{titleBarStyle:`hidden`/);
assert.doesNotMatch(patched, /n===`win32`\|\|n===`linux`/);
console.log("4/4 frameless-titlebar eval scenarios passed");
