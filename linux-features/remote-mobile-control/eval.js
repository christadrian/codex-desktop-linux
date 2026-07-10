#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyLinuxRemoteMobileAppServerRemoteControlPatch } = require("./patch.js");
const source = "var Wz=[`-c`,`features.code_mode_host=true`,`app-server`,`--analytics-default-enabled`]";
const patched = applyLinuxRemoteMobileAppServerRemoteControlPatch(source);
assert.match(patched, /codexLinuxRemoteMobileAppServerArgs/);
assert.match(patched, /`--remote-control`/);
console.log("2/2 remote-mobile-control eval scenarios passed");
