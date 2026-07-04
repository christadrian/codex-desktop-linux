#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { applyLinuxWhamAuthFallbackPatch } = require("../patches/core/all-linux/webview/wham-auth-fallback/patch.js");

function readFirstAsset(assetsDir, pattern, label) {
  const file = fs.readdirSync(assetsDir).sort().find((name) => pattern.test(name));
  if (file == null) throw new Error(`missing ${label}`);
  return { file, source: fs.readFileSync(path.join(assetsDir, file), "utf8") };
}

function readFirstAssetContaining(assetsDir, pattern, needle, label) {
  const file = fs
    .readdirSync(assetsDir)
    .sort()
    .find((name) => pattern.test(name) && fs.readFileSync(path.join(assetsDir, name), "utf8").includes(needle));
  if (file == null) throw new Error(`missing ${label}`);
  return { file, source: fs.readFileSync(path.join(assetsDir, file), "utf8") };
}

function hasAll(source, needles) {
  return needles.every((needle) => source.includes(needle));
}

function evaluate(assetsDir) {
  const usage = readFirstAsset(assetsDir, /^usage-settings-.*\.js$/, "usage settings asset");
  const preferences = readFirstAsset(assetsDir, /^cloud-preferences-.*\.js$/, "cloud preferences settings asset");
  const environments = readFirstAsset(assetsDir, /^cloud-environments-settings-page-.*\.js$/, "cloud environments settings asset");
  const tasks = readFirstAssetContaining(
    assetsDir,
    /^(?:thread-context-inputs-.*|sidebar-project-group-signals-.*|data-controls-.*|app-initial~app-main~.*)\.js$/,
    "/wham/tasks/list",
    "task list asset",
  );
  const patchedUsage = applyLinuxWhamAuthFallbackPatch(usage.source);
  const patchedPreferences = applyLinuxWhamAuthFallbackPatch(preferences.source);
  const patchedEnvironments = applyLinuxWhamAuthFallbackPatch(environments.source);
  const patchedTasks = applyLinuxWhamAuthFallbackPatch(tasks.source);
  return [
    {
      name: "usage daily fallback",
      file: usage.file,
      passed: hasAll(patchedUsage, ["/wham/usage/daily-token-usage-breakdown", "return{data:[],units:null}", "Unauthorized"]),
    },
    {
      name: "usage credit fallback",
      file: usage.file,
      passed: hasAll(patchedUsage, ["/wham/usage/credit-usage-events", "return{data:[]}", "Unauthorized"]),
    },
    {
      name: "settings task list fallback",
      file: tasks.file,
      passed: hasAll(patchedTasks, ["/wham/tasks/list", "return[]", "Unauthorized"]),
    },
    {
      name: "settings usage summary fallback",
      file: usage.file,
      passed: hasAll(patchedUsage, ["/wham/usage", "return null", "Unauthorized"]),
    },
    {
      name: "settings preferences fallback",
      file: preferences.file,
      passed: hasAll(patchedPreferences, ["/wham/settings/user", "/wham/settings/configs/user-preferences", "return null", "Unauthorized"]),
    },
    {
      name: "cloud environments fallback",
      file: environments.file,
      passed: hasAll(patchedEnvironments, ["/wham/environments/search", "return {items:[],cursor:null}", "/wham/machines", "return []", "Unauthorized"]),
    },
  ];
}

function main(argv = process.argv.slice(2)) {
  const assetsDir = path.resolve(argv[0] ?? "codex-app/content/webview/assets");
  const results = evaluate(assetsDir);
  for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"}\t${result.file}\t${result.name}`);
  const passed = results.filter((result) => result.passed).length;
  console.log(`wham settings auth fallback eval: ${passed}/${results.length}`);
  if (passed !== results.length) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { evaluate };
