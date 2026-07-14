#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  applyChatGptAuthBridgePatch,
  applyChatGptDualBackendPatch,
  applyChatNavigationPatch,
  applyCloudAccessPatch,
  applySitesPluginAvailabilityPatch,
  descriptors,
} = require("./patch.js");

const source =
  "var Ver,VZ;Ver=Da(G,({get:e})=>({enabled:e(Uy,`637432221`),queryKey:[`appgen`,`access`],queryFn:()=>tb.safeGet(`/wham/sites/access`)})),VZ=Ca(G,({get:e})=>{if(!e(Uy,`637432221`))return`unavailable`;let{data:t,isError:n}=e(Ver);return n||t?.enabled===!1?`unavailable`:t?.enabled===!0?`available`:`loading`});function F8e({accountId:e,accountLoading:t,additionalRolloutEnabled:n,authLoading:r,authMethod:i,authenticatedAccountId:a,plan:o,rolloutEnabled:s,supportedSurface:c}){return c?!s&&!n?{status:`denied`,reason:`rollout-disabled`}:r&&i==null?{status:`loading`}:i===`chatgpt`?t&&(e==null||o==null)?{status:`loading`}:a==null||e==null?{status:`denied`,reason:`missing-account`}:a===e?R8e(o)?{status:`allowed`,accountId:e,plan:o}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}";

const patched = applyChatGptDualBackendPatch(source);
assert.match(patched, /__codexLinuxChatGptBackendSession/);
assert.match(patched, /rollout-disabled/);
assert.match(patched, /not-chatgpt-auth/);
assert.match(patched, /__codexLinuxChatGptSitesAvailable/);
assert.match(patched, /if\(!0\)return`available`/);
assert.doesNotMatch(patched, /typeof globalThis\.__codexLinuxChatGptBackendSession/);
const navigation =
  "function IL({chatGptProjectCrudStatus:e,desktopNavItemsEnabled:t,quickChatEnabled:n,sidebarMode:r,onCreateChatGptProject:i}){return r===`codex`&&n?(0,KL.jsx)(kF,{}):null}const label={id:`sidebarElectron.quickChatNavLink`};";
assert.match(applyChatNavigationPatch(navigation), /__codexLinuxChatGptNavVisible/);
assert.doesNotMatch(applyChatNavigationPatch(navigation), /r===`codex`&&n/);
const cloud =
  "function vr(){let{access:P}=Sn();return P}function va(e){let{access:I}=Fn(),De=hr({cloudAccess:I,hasGitRepository:H,isBrowser:!1});return(0,Q.jsx)(Ji,{codexCloudAccess:I})}";
assert.equal((applyCloudAccessPatch(cloud).match(/__codexLinuxChatGptCloudAccess/g) ?? []).length, 2);
const sitesPlugin =
  "const bs=[{autoInstallOptOutKey:n.js(n.Os),installWhenMissing:!0,name:n.Os,isAvailable:({features:e})=>e.sites}];";
assert.match(applySitesPluginAvailabilityPatch(sitesPlugin), /__codexLinuxChatGptSitesPluginAvailable/);
assert.match(applySitesPluginAvailabilityPatch(sitesPlugin), /isAvailable:\(\)=>!0/);
const applyForAsset = (assetName, asset) => descriptors
  .filter((descriptor) => descriptor.phase === "webview-asset" && descriptor.pattern?.test(assetName))
  .sort((left, right) => left.order - right.order)
  .reduce((current, descriptor) => descriptor.apply(current), asset);
const currentChatAsset = applyForAsset("app-initial~app-main~page-kMhXWEru.js", navigation);
const currentCloudAsset = applyForAsset("local-remote-dropdown-C3bvVXka.js", cloud);
const currentSitesAsset = applyForAsset(
  "app-initial~app-main~pull-request-code-review~onboarding-page~hotkey-window-thread-page~cha~b76hmflu-y0KJWbm3.js",
  source,
);
const currentQuickChatEntitlementAsset = applyForAsset(
  "app-initial~artifact-tab-content.electron~app-main~pull-request-code-review~new-thread-pane~hlwvr2wg-y92DUo_J.js",
  source,
);
assert.match(currentChatAsset, /__codexLinuxChatGptNavVisible/);
assert.match(currentCloudAsset, /__codexLinuxChatGptCloudAccess/);
assert.match(currentSitesAsset, /__codexLinuxChatGptBackendSession/);
assert.match(currentSitesAsset, /if\(!0\)return`available`/);
assert.match(currentQuickChatEntitlementAsset, /status:`allowed`,accountId:globalThis\.__codexLinuxChatGptBackendSession,plan:null/);
const main = applyChatGptAuthBridgePatch(
  '"use strict";const fs=require("node:fs"),os=require("node:os"),path=require("node:path");var JF=class extends Error{};async function XF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i}){if(!i.attachAuth)return i;if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new JF(n,t,e)}}',
);
assert.match(main, /__codexLinuxChatGptSavedAuthToken/);
assert.match(main, /tokenSource:`saved-chatgpt`/);
assert.ok(main.indexOf("__codexLinuxChatGptSavedAuthToken()") < main.indexOf("getCachedAuthToken"));
assert.doesNotThrow(() => new Function("require", main));
console.log("10/10 chatgpt-dual-backend eval scenarios passed");
