#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const { applyProjectTaskSortPatch, descriptors } = require("./patch.js");

const asset =
  "app-initial-C-fROkKo.js";
const source =
  "function xe(e,{get:t}){let n=e;switch(n.kind){case`local`:return n.conversation==null?n.pendingWorktree.createdAt:t(xnr,n.conversation.id)??n.conversation.updatedAt;case`remote`:return(n.task.updated_at??n.task.created_at??0)*1e3;case void 0:return 0}}";

assert.ok(descriptors[0].pattern.test(asset));
const patched = applyProjectTaskSortPatch(source);
assert.match(patched, /Number\.parseInt\(n\.key\.slice\(6\)/);
assert.equal(applyProjectTaskSortPatch(patched), patched);

const context = {};
context.xnr = {};
vm.runInNewContext(`${patched};globalThis.timestamp=xe`, context);
const options = { get: () => null };
assert.ok(
  context.timestamp(
    {
      key: "local:019f0000-0000-7000-8000-000000000002",
      kind: "local",
      conversation: { recencyAt: 100 },
    },
    options,
  ) >
    context.timestamp(
      {
        key: "local:019e0000-0000-7000-8000-000000000001",
        kind: "local",
        conversation: { recencyAt: 400 },
      },
      options,
    ),
);

console.log("4/4 project-task-sort eval scenarios passed");
