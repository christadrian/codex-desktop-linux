#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyOpenInTargetsDirectoryModePatch } = require("./patch.js");
const source = '"open-in-targets":async()=>{let g=d||f!=null&&n.ys(f),_=f!=null&&KA(f),v=f!=null&&JA(f),y=g?await yF(i):_?await vF({filePath:f}):[]}';
const patched = applyOpenInTargetsDirectoryModePatch(source);
assert.match(patched, /codexLinuxOpenTargetIsDirectory/);
assert.match(patched, /g=d\|\|w\|\|/);
console.log("2/2 open-target-discovery eval scenarios passed");
