#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyProjectTaskSortPatch, descriptors } = require("./patch.js");

const source =
  "sidebarElectron.sortMenu.manual sidebarElectron.sortMenu.created case`local`:return e.conversation==null?e.pendingWorktree.createdAt:t===`updated_at`?e.conversation.recencyAt??e.conversation.updatedAt:e.conversation.createdAt";

assert.ok(descriptors[0].pattern.test("app-initial~app-main~page-kMhXWEru.js"));
assert.match(applyProjectTaskSortPatch(source), /Number\.parseInt/);
console.log("2/2 project-task-sort eval scenarios passed");
