#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyChatGptDualBackendPatch } = require("./patch.js");

const source =
  "function F8e({accountId:e,accountLoading:t,additionalRolloutEnabled:n,authLoading:r,authMethod:i,authenticatedAccountId:a,plan:o,rolloutEnabled:s,supportedSurface:c}){return c?!s&&!n?{status:`denied`,reason:`rollout-disabled`}:r&&i==null?{status:`loading`}:i===`chatgpt`?t&&(e==null||o==null)?{status:`loading`}:a==null||e==null?{status:`denied`,reason:`missing-account`}:a===e?R8e(o)?{status:`allowed`,accountId:e,plan:o}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}/* /wham/sites/access */";

const patched = applyChatGptDualBackendPatch(source);
assert.match(patched, /__codexLinuxChatGptBackendSession/);
assert.match(patched, /rollout-disabled/);
assert.match(patched, /not-chatgpt-auth/);
console.log("1/1 chatgpt-dual-backend eval scenarios passed");
