#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const {
  applyLinuxRemoteControlChatGptAuthPatch,
  applyLinuxRemoteMobileAppServerRemoteControlPatch,
} = require("./patch.js");
const source = "var Wz=[`-c`,`features.code_mode_host=true`,`app-server`,`--analytics-default-enabled`]";
const patched = applyLinuxRemoteMobileAppServerRemoteControlPatch(source);
assert.match(patched, /codexLinuxRemoteMobileAppServerArgs/);
assert.match(patched, /`--remote-control`/);
const authSource = "let f=require(`node:fs`),o=require(`node:os`),p=require(`node:path`);function L_(e){let t=process.env.CODEX_API_BASE_URL;return t&&t.trim().length>0?t.replace(/\\/+$/,``):e.prodApiBaseUrl}function R_(e,t){return`${L_(e)}/${t.replace(/^\\/+/,``)}`}async function z_({action:e=`connect remote control environments`,appServerClient:t,desktopOriginator:n,headers:r={},refreshToken:i=!1}){let o=await t.getAuthToken({refreshToken:i});if(!o)throw Error(`Sign in to ChatGPT to ${e}.`)}let action=`check remote control authorization`,endpoint=R_({prodApiBaseUrl:`https://chatgpt.com/backend-api`},`/codex/remote/control/client`);";
const authPatched = applyLinuxRemoteControlChatGptAuthPatch(authSource);
assert.match(authPatched, /codexLinuxRemoteControlSavedChatGptToken/);
assert.match(authPatched, /prodApiBaseUrl/);
console.log("4/4 remote-mobile-control eval scenarios passed");
