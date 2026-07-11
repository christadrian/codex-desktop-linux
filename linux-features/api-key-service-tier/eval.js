#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyCurrentGateAndModelPatch, applyCurrentFallbackFastTierPatch } = require("./patch.js");

const gate =
  "async function oyn(e,t){let n=await nyn(e,t);if(n!==`chatgpt`)return!1;let r=await DYt(t,{priority:`critical`});return e.query.setData(HW,{authMethod:n,hostId:t},r),r.requirements?.featureRequirements?.fast_mode!==!1}";
const fallback =
  "let defaultServiceTier=null;function Vqt(e){return[...(e?.serviceTiers??[]).map(e=>({description:zqt(e),iconKind:sU(e.id,e.name),label:Rqt(e),tier:e,value:e.id}))]}function Uqt(e){return e?.serviceTiers?.find(e=>sU(e.id,e.name)===`fast`||e.name.trim().toLowerCase()===`priority`)??null}";

assert.match(applyCurrentGateAndModelPatch(gate), /n===`apikey`\)return!0/);
assert.match(applyCurrentFallbackFastTierPatch(fallback), /codexLinuxApiKeyFastTier/);
console.log("2/2 api-key-service-tier eval scenarios passed");
