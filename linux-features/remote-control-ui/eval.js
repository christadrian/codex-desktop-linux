#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { descriptors } = require("./patch.js");

const remoteConnections = descriptors.find(({ id }) => id === "remote-connections-visibility");
const remoteControlConnections = descriptors.find(({ id }) => id === "remote-control-connections-visibility");
const remoteConnectionsAsset =
  "app-initial~app-main~new-thread-panel-page~onboarding-page~projects-index-page~appgen-libra~cci0ubce-current.js";
const remoteControlConnectionsAsset =
  "app-initial~avatarOverlayCompositionSurface~notebook-preview-panel~app-main~appgen-settings~el5fc9d5-current.js";

assert.ok(remoteConnections.pattern.test(remoteConnectionsAsset));
assert.ok(remoteControlConnections.pattern.test(remoteControlConnectionsAsset));
assert.ok(
  !remoteControlConnections.pattern.test(
    "app-initial~app-main~new-thread-panel-page~appgen-library-page~hotkey-window-thread-page~ho~iufn7mg3-previous.js",
  ),
);
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

console.log("5/5 remote-control-ui eval scenarios passed");
