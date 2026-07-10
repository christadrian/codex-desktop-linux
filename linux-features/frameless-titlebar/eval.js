#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyFramelessTitlebarMainPatch } = require("./patch.js");
const source = "case`quickChat`:case`primary`:return n===`darwin`?{titleBarStyle:`hiddenInset`,trafficLightPosition:A9(r),...e===`quickChat`?{hasShadow:!0,resizable:!0,transparent:!0}:{},...t?{}:{vibrancy:`menu`}}:n===`win32`||n===`linux`?{titleBarStyle:`hidden`,titleBarOverlay:j9(r),...e===`quickChat`?{resizable:!0}:{}}:{titleBarStyle:`default`,...e===`quickChat`?{resizable:!0}:{}};";
const patched = applyFramelessTitlebarMainPatch(source);
assert.match(patched, /n===`linux`\?\{titleBarStyle:`hidden`/);
assert.doesNotMatch(patched, /n===`win32`\|\|n===`linux`/);
console.log("2/2 frameless-titlebar eval scenarios passed");
