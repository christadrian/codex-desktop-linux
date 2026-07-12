#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyLinuxAppshotAvailabilityPatch, descriptors } = require("./patch.js");

const descriptor = descriptors.find(({ id }) => id === "linux-appshots-availability");
assert(descriptor);
assert(
  descriptor.pattern.test(
    "app-initial~app-main~new-thread-panel-page~appgen-library-page~hotkey-window-thread-page~ho~iufn7mg3-k1satKyX.js",
  ),
);

const source =
  "ER=r($,(e,{get:t})=>{if(t(yo)!==`macOS`||!t(nm,`1304276663`))return!1;let{data:n}=t(bd,{hostId:e});return n!=null&&n.requirements?.allowAppshots!==!1})";
const patched = applyLinuxAppshotAvailabilityPatch(source);
assert.match(patched, /t\(yo\)!==`linux`&&\(t\(yo\)!==`macOS`/);
assert.equal(applyLinuxAppshotAvailabilityPatch(patched), patched);

console.log("2/2 appshots eval scenarios passed");
