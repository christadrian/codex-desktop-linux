#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const {
  applyLinuxRemoteMobileAppServerRemoteControlPatch,
  applyLinuxRemoteControlLoadGatePatch,
  applyLinuxRemoteMobileConversationHydrationPatch,
} = require("./patch.js");
const source = "var Wz=[`-c`,`features.code_mode_host=true`,`app-server`,`--analytics-default-enabled`]";
const patched = applyLinuxRemoteMobileAppServerRemoteControlPatch(source);
assert.match(patched, /codexLinuxRemoteMobileAppServerArgs/);
assert.match(patched, /`--remote-control`/);
const loadGatePatched = applyLinuxRemoteControlLoadGatePatch(
  "function IXt(){return BC(`1042620455`)}",
);
assert.match(loadGatePatched, /codexLinuxRemoteControlLoadGateEnabled/);
const latestRuntimeStatusSource =
  "function a(e){return{threadRuntimeStatus:e.threadRuntimeStatus,resumeState:`needs_resume`}}function b(e){let{resumeState:t,threadRuntimeStatus:n}=e;return t===`needs_resume`?n?.type===`active`:!1}";
assert.equal(
  applyLinuxRemoteMobileConversationHydrationPatch(latestRuntimeStatusSource),
  latestRuntimeStatusSource,
);
console.log("4/4 remote-mobile-control eval scenarios passed");
