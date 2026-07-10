#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyAssistantRenderPatch } = require("./patch.js");

const current =
  "return (0,oG.jsx)(eu,{item:n,assistantCopyText:v,conversationId:u,renderCodeBlocksAsWritingBlocks:pe})";
const definition =
  "function eu({item:e,assistantCopyText:n,conversationId:r,renderCodeBlocksAsWritingBlocks:i}){return e}";

assert.match(applyAssistantRenderPatch(current), /codexLinuxReadAloudClick/);
assert.equal(applyAssistantRenderPatch(definition), definition);
console.log("PASS: current assistant render shape");
console.log("PASS: assistant component definition ignored");
