#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const { applyProjectTaskSortPatch, descriptors } = require("./patch.js");

const asset =
  "app-initial~app-main~onboarding-page~projects-index-page~quick-chat-window-page~codex-micro~iqsnin5k-zeUk_LBG.js";
const source =
  "function xe(e,t){switch(e.kind){case`local`:return e.conversation==null?e.pendingWorktree.createdAt:t===`updated_at`?e.conversation.recencyAt??e.conversation.updatedAt:e.conversation.createdAt;case`remote`:return((t===`updated_at`?e.task.updated_at??e.task.created_at:e.task.created_at??e.task.updated_at)??0)*1e3}}";

assert.ok(descriptors[0].pattern.test(asset));
const patched = applyProjectTaskSortPatch(source);
assert.match(patched, /Number\.parseInt\(e\.key\.slice\(6\)/);
assert.equal(applyProjectTaskSortPatch(patched), patched);

const context = {};
vm.runInNewContext(`${patched};globalThis.timestamp=xe`, context);
assert.ok(
  context.timestamp(
    {
      key: "local:019f0000-0000-7000-8000-000000000002",
      kind: "local",
      conversation: { recencyAt: 100 },
    },
    "created_at",
  ) >
    context.timestamp(
      {
        key: "local:019e0000-0000-7000-8000-000000000001",
        kind: "local",
        conversation: { recencyAt: 400 },
      },
      "created_at",
    ),
);

console.log("4/4 project-task-sort eval scenarios passed");
