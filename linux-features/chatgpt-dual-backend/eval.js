#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  applyChatGptAuthBridgePatch,
  applyChatGptDualBackendPatch,
  applyChatNavigationPatch,
  descriptors,
} = require("./patch.js");

const source =
  "function F8e({accountId:e,accountLoading:t,additionalRolloutEnabled:n,authLoading:r,authMethod:i,authenticatedAccountId:a,plan:o,rolloutEnabled:s,supportedSurface:c}){return c?!s&&!n?{status:`denied`,reason:`rollout-disabled`}:r&&i==null?{status:`loading`}:i===`chatgpt`?t&&(e==null||o==null)?{status:`loading`}:a==null||e==null?{status:`denied`,reason:`missing-account`}:a===e?R8e(o)?{status:`allowed`,accountId:e,plan:o}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}/* /wham/sites/access */";

const patched = applyChatGptDualBackendPatch(source);
assert.match(patched, /__codexLinuxChatGptBackendSession/);
assert.match(patched, /rollout-disabled/);
assert.match(patched, /not-chatgpt-auth/);
const navigation =
  "function LJe(){let e=(0,RJe.c)(23),t=xu(Z),n=X(Zte),r=X(Hle),i=X(qS),a=Ld(ov,`quickChat`),o=!r&&i===`hidden`;return o?null:(0,IL.jsx)(G,{id:`sidebarElectron.quickChatNavLink`,defaultMessage:`Chat`})}";
assert.match(applyChatNavigationPatch(navigation), /__codexLinuxChatGptNavVisible/);
const applyForAsset = (assetName, asset) => descriptors
  .filter((descriptor) => descriptor.phase === "webview-asset" && descriptor.pattern?.test(assetName))
  .sort((left, right) => left.order - right.order)
  .reduce((current, descriptor) => descriptor.apply(current), asset);
const currentChatAsset = applyForAsset("app-initial~app-main~page-CQfFDtNf.js", navigation);
const currentSitesAsset = applyForAsset(
  "app-initial~app-main~pull-request-code-review~onboarding-page~hotkey-window-thread-page~cha~b76hmflu-y0KJWbm3.js",
  source,
);
assert.match(currentChatAsset, /__codexLinuxChatGptNavVisible/);
assert.match(currentSitesAsset, /__codexLinuxChatGptBackendSession/);
const main = applyChatGptAuthBridgePatch(
  '"use strict";const fs=require("node:fs"),os=require("node:os"),path=require("node:path");var JF=class extends Error{};async function XF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i}){if(!i.attachAuth)return i;if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new JF(n,t,e)}}',
);
assert.match(main, /__codexLinuxChatGptSavedAuthToken/);
assert.match(main, /tokenSource:`saved-chatgpt`/);
assert.match(main, /typeof __cdlxCachedToken===`string`/);
assert.doesNotThrow(() => new Function("require", main));
console.log("4/4 chatgpt-dual-backend eval scenarios passed");
