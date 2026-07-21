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
const latestLateCompletionSource =
  "class T{onNotification(e,t){let n={method:e,params:t};switch(n.method){case`turn/completed`:{if(this.frameTextDeltaQueue.drainBefore(()=>{this.onNotification(`turn/completed`,n.params)}))break;let{threadId:e,turn:t}=n.params,r=I(e);if(!this.conversations.get(r)){z.error(`Received turn/completed for unknown conversation`,{safe:{conversationId:r},sensitive:{}});break}}}}}";
const latestLateCompletionPatched =
  applyLinuxRemoteMobileConversationHydrationPatch(latestLateCompletionSource);
assert.match(latestLateCompletionPatched, /codexLinuxRemoteMobileHydrateLateEvent/);
assert.match(latestLateCompletionPatched, /this\.frameTextDeltaQueue\.drainBefore/);
console.log("5/5 remote-mobile-control eval scenarios passed");
