#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { descriptors } = require("./patch.js");

assert.equal(descriptors[0].id, "pet-overlay-main");
const result = spawnSync(
  process.execPath,
  ["--test", "--test-name-pattern", "Niri endDrag drains", path.join(__dirname, "test.js")],
  { encoding: "utf8" },
);
assert.equal(result.status, 0, result.stderr || result.stdout);
assert.match(result.stdout, /Niri endDrag drains the final move before persisting and docking/);
console.log("2/2 pet-overlay eval scenarios passed");
