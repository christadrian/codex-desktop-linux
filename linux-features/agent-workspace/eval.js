#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  SETTINGS_ASSET,
  applyAgentWorkspaceSettingsIndexPatch,
} = require("./patch.js");

const current =
  'var routes={"general-settings":BN(async()=>(await Y(async()=>{let{GeneralSettings:e}=await import(`./general-settings-current.js`);return{GeneralSettings:e}},deps,import.meta.url)).GeneralSettings)}';

const patched = applyAgentWorkspaceSettingsIndexPatch(current);
assert.match(patched, new RegExp(SETTINGS_ASSET));
assert.match(patched, /\.AgentWorkspacesSettings/);
assert.throws(
  () => applyAgentWorkspaceSettingsIndexPatch('var routes={"general-settings":drifted}'),
  /could not add agent workspace settings route/,
);
console.log("PASS: current async settings route");
console.log("PASS: drifted settings route rejected");
