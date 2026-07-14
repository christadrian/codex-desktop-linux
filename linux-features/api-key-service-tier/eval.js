#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const {
  applyCurrentGatePatch,
  applyCurrentFallbackFastTierPatch,
  applyCurrentModelPatch,
  descriptors,
} = require("./patch.js");

const gate =
  "function sxe(e){let t=(0,cxe.c)(6),n=X(os),r=e?.hostId??n,i=Cf(r),a=i?.authMethod===`chatgpt`,o=i?.authMethod??null,s;t[0]!==r||t[1]!==o?(s={authMethod:o,hostId:r},t[0]=r,t[1]=o,t[2]=s):s=t[2];let{data:c,isPending:l}=ye(is,s),u=!!i?.isLoading||a&&l,d=a&&!u&&c!=null&&c?.requirements?.featureRequirements?.fast_mode!==!1,f;return t[3]!==u||t[4]!==d?(f={isServiceTierAllowed:d,isLoading:u},t[3]=u,t[4]=d,t[5]=f):f=t[5],f}";
const fallback =
  "let defaultServiceTier=null;function Vqt(e){return[...(e?.serviceTiers??[]).map(e=>({description:zqt(e),iconKind:sU(e.id,e.name),label:Rqt(e),tier:e,value:e.id}))]}function Uqt(e){return e?.serviceTiers?.find(e=>sU(e.id,e.name)===`fast`||e.name.trim().toLowerCase()===`priority`)??null}";
const fallbackDescriptor = require("./patch.js").descriptors.find(
  ({ id }) => id === "api-key-service-tier-fallback",
);
const modelDescriptor = descriptors.find(({ id }) => id === "api-key-service-tier-model");
const model =
  "function vbe({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=o&&e!==`amazonBedrock`,u=a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`max`)),d=i&&a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`ultra`));return a.forEach(n=>{if(l?t.has(n.model):!n.hidden){let t=i?n.supportedReasoningEfforts:n.supportedReasoningEfforts.filter(({reasoningEffort:e})=>e!==`ultra`),a=(e===`copilot`?[t.find(e=>e.reasoningEffort===`medium`)??{reasoningEffort:`medium`,description:`medium effort`}]:t).filter(({reasoningEffort:e})=>Gx(e)&&r.has(e)),o={...n,supportedReasoningEfforts:a};s.push(o),n.isDefault&&(c=o)}}),c??=s.find(e=>e.model===n)??null,{models:s,defaultModel:c}}";

assert.match(
  applyCurrentGatePatch(gate),
  /d=!u&&\(a\?c!=null&&c\?\.requirements\?\.featureRequirements\?\.fast_mode!==!1:o===`apikey`\)/,
);
assert.match(applyCurrentFallbackFastTierPatch(fallback), /codexLinuxApiKeyFastTier/);
assert.ok(modelDescriptor.pattern.test("app-initial~app-main~onboarding-page-qmFVRsFx.js"));
assert.match(applyCurrentModelPatch(model), /codexLinuxApiKeyServiceTierModel/);
assert.match(
  "app-initial~app-main~onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~gwqc41kz-CnQKtQ6U.js",
  fallbackDescriptor.pattern,
);
console.log("5/5 api-key-service-tier eval scenarios passed");
