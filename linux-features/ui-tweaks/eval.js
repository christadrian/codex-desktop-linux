#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  applySidebarProjectNameStylePatch,
  RUNTIME_MARKER,
} = require("./patches/sidebar-project-name.js");
const {
  DYNAMIC_POWER_EFFORTS_RUNTIME_MARKER,
  GPT_56_ALLOWLIST_MARKER,
  INLINE_MODEL_LIST_RUNTIME_MARKER,
  MODEL_ALLOWLIST_MARKER,
  applyDynamicSupportedReasoningEffortsPatch,
  applyGpt56AllowlistPatch,
  applyInlineModelListPatch,
} = require("./patches/model-picker-model-list.js");

const current =
  "let row=Q(`group/folder-row group relative flex`);let name=(0,Af.jsx)(`span`,{className:`text-fade-truncate pr-1`,children:g})";
const unrelated = "console.log('not a project sidebar')";

assert.match(applySidebarProjectNameStylePatch(current), new RegExp(RUNTIME_MARKER));
assert.equal(applySidebarProjectNameStylePatch(unrelated), unrelated);
const menu =
  `id:\`composer.intelligenceDropdown.model.title\`;const allowed=${MODEL_ALLOWLIST_MARKER};let ce=models;let le=ce,ue;id:\`composer.intelligenceDropdown.model.rowLabel\`;id:\`composer.intelligenceDropdown.effort.title\`;let Ce=(0,PU.jsxs)(PU.Fragment,{children:[ve,effort]});`;
const power =
  "function ARe(e,t=!1){let n=PRe(t?[...FRe,URe]:FRe,e);if(n.length>=4)return n;let r=PRe(IRe,e);return r.length>=4?r:[]}function MRe(e){return e?.flatMap(({displayName:e,model:t,supportedReasoningEfforts:n})=>{let r=e==null?`Custom`:e,i=n.flatMap(({reasoningEffort:e})=>[e]);return(i.length>0?i:[`medium`]).map(e=>({id:`${t}:${e}`,model:t,modelLabel:r,reasoningEffort:e}))})??[]}function PRe(e,t){return e.flatMap((e,n)=>t?.some(t=>t.model===e.model&&t.supportedReasoningEfforts.some(({reasoningEffort:t})=>t===e.reasoningEffort))?[{...e,powerSettingIndex:n}]:[])}var FRe=[],URe={id:`gpt-5.6-sol:ultra`,model:`gpt-5.6-sol`,modelLabel:`5.6 Sol`,reasoningEffort:`ultra`},IRe=[];";
assert.match(applyGpt56AllowlistPatch(menu), new RegExp(GPT_56_ALLOWLIST_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(applyInlineModelListPatch(menu), new RegExp(INLINE_MODEL_LIST_RUNTIME_MARKER));
assert.match(
  applyDynamicSupportedReasoningEffortsPatch(power),
  new RegExp(DYNAMIC_POWER_EFFORTS_RUNTIME_MARKER),
);
console.log("PASS: current project-name shape");
console.log("PASS: current model-picker split bundle shapes");
console.log("PASS: unrelated asset ignored");
