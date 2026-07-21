#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  STORAGE_KEY,
  applyPersistentStatusPanelPatch,
  descriptors,
} = require("./patch.js");

const source =
  "function nW(e){let t=(0,iW.c)(26),{conversationId:n,threadId:r,rateLimit:i,onOpenChange:a}=e,o=Wr(),[s,c]=(0,aW.useState)(!1),{activeMode:l}=vm(n),u=l?.settings.model??null,d=Pn(Bc,n),f;t[0]===d?f=t[1]:(f=nR(d),t[0]=d,t[1]=f);let y,b;t[10]===a?(y=t[11],b=t[12]):(y=async()=>{c(!0),a?.(!0)},b=[a],t[10]=a,t[11]=y,t[12]=b);let v=o.formatMessage({id:`composer.statusSlashCommand.description`,defaultMessage:`Show task id, context usage, and rate limits`}),x={id:`status`,onSelect:y};if(!s)return null;let S;t[18]===a?S=t[19]:(S=()=>{c(!1),a?.(!1)},t[18]=a,t[19]=S);return FU({threadId:r,onClose:S})}";
const asset =
  "app-initial~app-main~settings-command-menu-section-items~new-thread-panel-page~settings-pag~unq8yzli-current.js";
const patched = applyPersistentStatusPanelPatch(source);
const originalWarn = console.warn;
console.warn = () => {};
const unrelated = applyPersistentStatusPanelPatch("unrelated");
console.warn = originalWarn;

assert(descriptors[0].pattern.test(asset));
assert.match(patched, new RegExp(STORAGE_KEY));
assert.equal(applyPersistentStatusPanelPatch(patched), patched);
assert.equal(unrelated, "unrelated");
console.log("4/4 persistent-status-panel eval scenarios passed");
