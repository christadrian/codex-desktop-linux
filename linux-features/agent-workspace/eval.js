#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  SETTINGS_ASSET,
  applyAgentWorkspaceSettingsIndexPatch,
  applyAgentWorkspaceSettingsPagePatch,
} = require("./patch.js");

const current =
  'var routes={"general-settings":BN(async()=>(await Y(async()=>{let{GeneralSettings:e}=await import(`./general-settings-current.js`);return{GeneralSettings:e}},deps,import.meta.url)).GeneralSettings)}';

const patched = applyAgentWorkspaceSettingsIndexPatch(current);
assert.match(patched, new RegExp(SETTINGS_ASSET));
assert.match(patched, /\)\.default\),"general-settings":/);
assert.throws(
  () => applyAgentWorkspaceSettingsIndexPatch('var routes={"general-settings":drifted}'),
  /could not add agent workspace settings route/,
);
const currentNavigation =
  'Zt=h({collapseSidebar:{id:`settings.nav.collapseSidebar`}}),Qt=[`general-settings`,`local-environments`,`worktrees`,`data-controls`],$t=[{key:`coding`,slugs:[`local-environments`,`environments`,`worktrees`]}]';
const patchedNavigation = applyAgentWorkspaceSettingsPagePatch(currentNavigation);
assert.match(patchedNavigation, /`local-environments`,`agent-workspaces`,`worktrees`/);
assert.match(
  patchedNavigation,
  /slugs:\[`local-environments`,`agent-workspaces`,`environments`,`worktrees`\]/,
);
console.log("PASS: current async settings route");
console.log("PASS: current sidebar-only settings navigation");
console.log("PASS: drifted settings route rejected");
