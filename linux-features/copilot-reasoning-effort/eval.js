#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const {
  applyCopilotReasoningEffortSettingsPatch,
  applyCopilotReasoningEffortModelListPatch,
  applyCopilotReasoningEffortUiPatch,
  descriptors,
} = require("./patch.js");

const models =
  "function Jv({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null;return a.forEach(n=>{let t=n.supportedReasoningEfforts,a=(e===`copilot`?[t.find(e=>e.reasoningEffort===`medium`)??{reasoningEffort:`medium`,description:`medium effort`}]:t).filter(({reasoningEffort:e})=>vg(e)&&r.has(e)),o={...n,supportedReasoningEfforts:a};s.push(o)}),s}";
const ui =
  "function dz(){let k=!Bm(u),A=a?.authMethod===`copilot`,j=!k&&!A,M=yh(d,m);return aO(`composer.increaseReasoningEffort`,()=>we(`increase`),{enabled:j}),(0,gz.jsx)(_m,{reasoningEffortDisabled:A})}";
const settings =
  "function Va(){let e=(0,Ya.c)(3),t=ua(),{data:n,isLoading:r}=hn(`copilot-default-model`),i=n??t.defaultModel,a;return e[0]!==r||e[1]!==i?(a={model:i,reasoningEffort:`medium`,profile:null,isLoading:r},e[0]=r,e[1]=i,e[2]=a):a=e[2],a}function currentWriter(){let u=!0,l=!0,n={},m={profile:null},a=`host`,f=`/tmp`,r={cancelQueries:async()=>{},getQueryData:()=>null},E=async()=>!1,ln=async()=>{},za=()=>[],Xe={info:()=>{}},j=()=>{};return async(e,t)=>{let i=null,o;try{if(await E(e,t))return;if(u){await ln(n,`copilot-default-model`,e,{throwOnFailure:!0});return}if(!l)throw Error(`Model settings host is unavailable`);i=za(a,f);let s={hostId:a,cwd:f};await r.cancelQueries({exact:!0,queryKey:i}),o=r.getQueryData(i),Xe.info(`Setting default model and reasoning effort`,{safe:{newModel:e,newEffort:t,profile:m.profile}})}catch(e){j(e)}}}";

assert.doesNotMatch(applyCopilotReasoningEffortModelListPatch(models), /e===`copilot`\?\[/);
assert.match(applyCopilotReasoningEffortUiPatch(ui), /reasoningEffortDisabled:!1/);
assert.match(applyCopilotReasoningEffortSettingsPatch(settings), /copilot-default-reasoning-effort/);
const latestUi =
  "function latest(){let I=u?.authMethod===`copilot`,F=!1,B=!F&&!I&&!0,V=!1;kX(`composer.increaseReasoningEffort`,()=>{Se(`increase`)},{enabled:B});kX(`composer.decreaseReasoningEffort`,()=>{Se(`decrease`)},{enabled:B});return(0,z$.jsx)(Control,{reasoningEffortDisabled:I})}";
assert.match(applyCopilotReasoningEffortUiPatch(latestUi), /B=!F&&!0/);
assert.ok(
  descriptors
    .filter(({ id }) => id === "settings" || id === "model-list")
    .every(({ pattern }) => pattern.test("app-initial-C-fROkKo.js")),
);
console.log("5/5 copilot-reasoning-effort eval scenarios passed");
