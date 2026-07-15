#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const stage = fs.readFileSync(path.join(__dirname, "stage.sh"), "utf8");
const readme = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");

assert.doesNotMatch(stage, /install .*node-repl-wrapper/);
assert.match(stage, /restore_previous_node_repl_wrapper/);
assert.match(readme, /their helper children are never reaped/);
console.log("3/3 mcp-helper-reaper eval scenarios passed");
