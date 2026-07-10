#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  applySidebarProjectNameStylePatch,
  RUNTIME_MARKER,
} = require("./patches/sidebar-project-name.js");

const current =
  "let row=Q(`group/folder-row group relative flex`);let name=(0,Af.jsx)(`span`,{className:`text-fade-truncate pr-1`,children:g})";
const unrelated = "console.log('not a project sidebar')";

assert.match(applySidebarProjectNameStylePatch(current), new RegExp(RUNTIME_MARKER));
assert.equal(applySidebarProjectNameStylePatch(unrelated), unrelated);
console.log("PASS: current project-name shape");
console.log("PASS: unrelated asset ignored");
