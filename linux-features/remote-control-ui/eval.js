#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { descriptors } = require("./patch.js");

const remoteConnections = descriptors.find(({ id }) => id === "remote-connections-visibility");
const remoteControlConnections = descriptors.find(({ id }) => id === "remote-control-connections-visibility");
const remoteConnectionsAsset =
  "app-initial~app-main~onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~gwqc41kz-CnQKtQ6U.js";
const remoteControlConnectionsAsset =
  "app-initial~app-main~appgen-settings-page~plugin-detail-page~new-thread-panel-page~onboardi~lxr449xn-w-gqR6Hk.js";

assert.ok(remoteConnections.pattern.test(remoteConnectionsAsset));
assert.ok(remoteControlConnections.pattern.test(remoteControlConnectionsAsset));
assert.match(
  remoteConnections.apply("const enabled=BC(`4114442250`);"),
  /navigator\.userAgent\.includes\(`Linux`\)/,
);
assert.match(
  remoteControlConnections.apply(
    "function Vn({remoteControlConnectionsState:e,slingshotEnabled:t}){return t&&(e?.available??!0)&&e?.accessRequired!==!0}",
  ),
  /navigator\.userAgent\.includes\(`Linux`\)/,
);

console.log("4/4 remote-control-ui eval scenarios passed");
