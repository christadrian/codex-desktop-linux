#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const {
  applyCopilotReasoningEffortModelListPatch,
  applyCopilotReasoningEffortUiPatch,
} = require("./patch.js");

const models =
  "function Jv({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null;return a.forEach(n=>{let t=n.supportedReasoningEfforts,a=(e===`copilot`?[t.find(e=>e.reasoningEffort===`medium`)??{reasoningEffort:`medium`,description:`medium effort`}]:t).filter(({reasoningEffort:e})=>vg(e)&&r.has(e)),o={...n,supportedReasoningEfforts:a};s.push(o)}),s}";
const ui =
  "function dz(){let k=!Bm(u),A=a?.authMethod===`copilot`,j=!k&&!A,M=yh(d,m);return aO(`composer.increaseReasoningEffort`,()=>we(`increase`),{enabled:j}),(0,gz.jsx)(_m,{reasoningEffortDisabled:A})}";

assert.doesNotMatch(applyCopilotReasoningEffortModelListPatch(models), /e===`copilot`\?\[/);
assert.match(applyCopilotReasoningEffortUiPatch(ui), /reasoningEffortDisabled:!1/);
console.log("2/2 copilot-reasoning-effort eval scenarios passed");
