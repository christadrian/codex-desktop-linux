#!/usr/bin/env node
"use strict";

// Diagnose the custom-endpoint-model-picker feature against an INSTALLED app.
//
// Usage:
//   node linux-features/custom-endpoint-model-picker/doctor.js [--install-dir codex-app]
//   node linux-features/custom-endpoint-model-picker/doctor.js --extracted /path/to/extracted-app
//
// Checks, in order:
//   1. config.toml + model catalog (the runtime data source)
//   2. patch-report.json descriptor statuses from the last build
//   3. the app.asar main bundle: which listModels shape is present (pristine /
//      v1 / v2 / v3), whether the merge helper is injected
//   4. webview asset chunks: allowlist guard, catalog/composer injection markers
//
// Exits non-zero when the feature cannot work in the current install.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { internals } = require("./patch.js");

const args = process.argv.slice(2);
function argValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : undefined;
}

const repoRoot = path.resolve(__dirname, "..", "..");
const installDir = path.resolve(argValue("--install-dir") ?? process.env.CODEX_INSTALL_DIR ?? path.join(repoRoot, "codex-app"));
const extractedDir = argValue("--extracted") ? path.resolve(argValue("--extracted")) : null;
const webviewAssetsDir = path.resolve(argValue("--webview") ?? path.join(installDir, "content", "webview", "assets"));
const reportPath = path.resolve(argValue("--report") ?? path.join(installDir, ".codex-linux", "patch-report.json"));
const asarPath = path.resolve(argValue("--asar") ?? path.join(installDir, "resources", "app.asar"));

let failures = 0;
let warnings = 0;
function pass(msg) { console.log(`PASS  ${msg}`); }
function info(msg) { console.log(`INFO  ${msg}`); }
function warn(msg) { warnings += 1; console.log(`WARN  ${msg}`); }
function fail(msg) { failures += 1; console.log(`FAIL  ${msg}`); }
function section(title) { console.log(`\n== ${title} ==`); }

function expandHome(candidate) {
  return typeof candidate === "string" && candidate.startsWith("~")
    ? path.join(os.homedir(), candidate.slice(1))
    : candidate;
}

// ---------------------------------------------------------------------------
// 1. Config + catalog
// ---------------------------------------------------------------------------

section("config.toml + model catalog");
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const configPath = path.join(codexHome, "config.toml");
let catalogModelCount = 0;
try {
  const config = fs.readFileSync(configPath, "utf8");
  const catalogPath = config.match(/^\s*model_catalog_json\s*=\s*["']([^"']+)["']/m)?.[1];
  const selectedModel = config.match(/^\s*model\s*=\s*["']([^"']+)["']/m)?.[1];
  if (!catalogPath) {
    fail(`${configPath}: no model_catalog_json key — the picker lists models ONLY from this catalog`);
  } else {
    pass(`model_catalog_json = ${catalogPath}`);
    try {
      const catalog = JSON.parse(fs.readFileSync(expandHome(catalogPath), "utf8"));
      const models = Array.isArray(catalog) ? catalog : Array.isArray(catalog?.models) ? catalog.models : [];
      const slugs = models.map((m) => m?.slug ?? m?.model).filter((s) => typeof s === "string" && s);
      catalogModelCount = slugs.length;
      if (slugs.length === 0) {
        fail(`catalog parsed but contains no entries with a string slug/model`);
      } else {
        pass(`catalog parses: ${slugs.length} models (${slugs.slice(0, 3).join(", ")}${slugs.length > 3 ? ", …" : ""})`);
        if (selectedModel && !slugs.includes(selectedModel)) {
          warn(`config model = "${selectedModel}" is not in the catalog — no entry will be marked default`);
        }
      }
    } catch (error) {
      fail(`catalog unreadable at ${catalogPath}: ${error.message}`);
    }
  }
} catch (error) {
  fail(`cannot read ${configPath}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// 2. Patch report
// ---------------------------------------------------------------------------

section(`patch report (${reportPath})`);
try {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const enabled = report.enabledFeatures ?? [];
  if (enabled.includes("custom-endpoint-model-picker")) {
    pass(`feature was enabled at build time (enabledFeatures: ${JSON.stringify(enabled)})`);
  } else {
    fail(`feature NOT in enabledFeatures ${JSON.stringify(enabled)} — add it to linux-features/features.json and rebuild`);
  }
  for (const name of [
    "feature:custom-endpoint-model-picker:main-bundle-catalog-models",
    "feature:custom-endpoint-model-picker:model-picker-allowlist",
    "feature:custom-endpoint-model-picker:sidebar-provider-filter",
  ]) {
    const entry = (report.patches ?? []).find((p) => p.name === name);
    if (!entry) {
      fail(`${name}: missing from report`);
    } else if (["applied", "already-applied"].includes(entry.status)) {
      pass(`${name}: ${entry.status}`);
    } else {
      fail(`${name}: ${entry.status}${entry.reason ? ` (${entry.reason})` : ""}`);
    }
  }
} catch (error) {
  warn(`no readable patch report: ${error.message}`);
}

// ---------------------------------------------------------------------------
// 3. Main bundle (app.asar or extracted dir)
// ---------------------------------------------------------------------------

// Minimal asar reader: header = uint32(4) | uint32(headerPickleSize) |
// uint32(stringPickleSize) | uint32(jsonLength) | json; content follows at
// 8 + headerPickleSize.
function readAsar(asarFile) {
  const buffer = fs.readFileSync(asarFile);
  const headerPickleSize = buffer.readUInt32LE(4);
  const jsonLength = buffer.readUInt32LE(12);
  const header = JSON.parse(buffer.subarray(16, 16 + jsonLength).toString("utf8"));
  const base = 8 + headerPickleSize;
  const files = new Map();
  (function walk(node, prefix) {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const filePath = prefix ? `${prefix}/${name}` : name;
      if (entry.files) {
        walk(entry, filePath);
      } else if (!entry.unpacked && entry.offset != null) {
        files.set(filePath, () => buffer.subarray(base + Number(entry.offset), base + Number(entry.offset) + entry.size).toString("utf8"));
      }
    }
  })(header, "");
  return files;
}

section("main bundle (app-server bridge)");
let mainSources = [];
try {
  if (extractedDir) {
    const buildDir = path.join(extractedDir, ".vite", "build");
    mainSources = fs.readdirSync(buildDir)
      .filter((name) => name.endsWith(".js"))
      .map((name) => ({ name, read: () => fs.readFileSync(path.join(buildDir, name), "utf8") }));
    info(`scanning extracted dir ${buildDir}`);
  } else {
    const files = readAsar(asarPath);
    mainSources = [...files.entries()]
      .filter(([name]) => name.startsWith(".vite/build/") && name.endsWith(".js"))
      .map(([name, read]) => ({ name, read }));
    info(`scanning ${asarPath} (${mainSources.length} bundle files)`);
  }
} catch (error) {
  fail(`cannot read main bundles: ${error.message} — pass --extracted <dir> or --asar <file>`);
}

let bridgeFound = false;
for (const { name, read } of mainSources) {
  let source;
  try { source = read(); } catch { continue; }
  if (!source.includes("model/list") || !/async listModels\(/.test(source)) continue;
  bridgeFound = true;
  const helperV3 = source.includes(internals.MAIN_HELPER_MARKER);
  const appliedV3 = source.includes(internals.MAIN_LIST_MODELS_APPLIED_MARKER);
  const legacyHelper = source.includes("__codexLinuxMergeCustomEndpointCatalogModels=function(");
  const v0 = internals.MAIN_LIST_MODELS_NEEDLE.test(source);
  const v1 = internals.MAIN_LIST_MODELS_V1_PATCH_NEEDLE.test(source);
  const v2 = internals.MAIN_LIST_MODELS_V2_PATCH_NEEDLE.test(source);
  const uuidVar = source.match(/`model\/list:\$\{\(0,(\w+)\.randomUUID\)\(\)\}`/)?.[1];
  info(`bridge chunk: ${name}${uuidVar ? ` (randomUUID module var: ${uuidVar})` : ""}`);
  if (appliedV3 && helperV3) {
    pass(`v3 patch applied (helper + rewritten listModels)`);
  } else if (v0) {
    fail(`listModels is PRISTINE upstream — the catalog merge patch is not applied; rebuild with the feature enabled`);
  } else if (v1 || v2) {
    fail(`listModels carries a STALE ${v1 ? "v1" : "v2"} patch${legacyHelper ? " + legacy helper" : ""} — rebuild so it upgrades to v3`);
  } else {
    fail(`listModels matches NO known shape — upstream drifted; re-extract the bundle and update the needles (see README)`);
  }
}
if (mainSources.length > 0 && !bridgeFound) {
  fail(`no chunk with an "async listModels(" bridge found under .vite/build`);
}

// ---------------------------------------------------------------------------
// 4. Webview assets
// ---------------------------------------------------------------------------

section(`webview assets (${webviewAssetsDir})`);
try {
  const assets = fs.readdirSync(webviewAssetsDir).filter((name) => name.endsWith(".js"));
  const pickerChunks = assets.filter((name) => internals.ALLOWLIST_ASSET_PATTERN.test(name));
  const sidebarChunks = assets.filter((name) => internals.SIDEBAR_ASSET_PATTERN.test(name));
  if (pickerChunks.length === 0) {
    fail(`no chunk matches the allowlist pattern — upstream renamed its chunks; update the descriptor pattern`);
  }
  let guardHandled = false;
  let composerInjected = false;
  let composerNeedleMatches = 0;
  for (const name of pickerChunks) {
    const source = fs.readFileSync(path.join(webviewAssetsDir, name), "utf8");
    const isPickerComponent = /useHiddenModels/.test(source) && /amazonBedrock|models:\w+,useHiddenModels/.test(source);
    if (internals.PICKER_CURRENT_NEEDLE.test(source) || internals.PICKER_NEEDLE.test(source)) {
      fail(`${name}: allowlist guard STILL ACTIVE — patch did not run on this chunk`);
    } else if (internals.PICKER_CURRENT_APPLIED.test(source) || internals.PICKER_GUARD_DISABLED_MARKER.test(source)) {
      pass(`${name}: allowlist guard disabled (l=!1)`);
      guardHandled = true;
    } else if (isPickerComponent) {
      warn(`${name}: picker component present but guard shape unrecognized (drift?)`);
    }
    if (source.includes(internals.PICKER_COMPOSER_MENU_MARKER)) {
      composerInjected = true;
      pass(`${name}: composer-menu catalog injection present`);
    } else {
      composerNeedleMatches += internals.PICKER_COMPOSER_MENU_NEEDLES.filter((needle) => needle.test(source)).length;
    }
    if (source.includes(internals.PICKER_WEBVIEW_CATALOG_MARKER)) {
      pass(`${name}: picker catalog injection present`);
    }
    if (source.includes(internals.PICKER_REASONING_FALLBACK_MARKER)) {
      pass(`${name}: picker reasoning fallback present`);
    }
  }
  if (!guardHandled) {
    warn(`no chunk shows the disabled allowlist guard — custom models may be filtered out of the picker`);
  }
  if (!composerInjected && composerNeedleMatches > 0) {
    info(`composer-menu needles match ${composerNeedleMatches} site(s) but injection absent — a rebuild (with the catalog configured) will bake it in`);
  }
  if (sidebarChunks.length === 0) {
    warn(`no chunk matches the sidebar pattern`);
  } else {
    const patched = sidebarChunks.some((name) => {
      const source = fs.readFileSync(path.join(webviewAssetsDir, name), "utf8");
      return internals.ASYNC_APPLIED_MARKER.test(source) || internals.SIDEBAR_APPLIED_MARKER.test(source) || internals.BLANK_THREAD_FILTER_APPLIED_MARKER.test(source);
    });
    if (patched) pass(`sidebar provider filter applied`);
    else warn(`sidebar provider filter not detected in ${sidebarChunks.length} matching chunk(s)`);
  }
} catch (error) {
  fail(`cannot read webview assets: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

section("verdict");
if (failures === 0) {
  console.log(`OK — config, patches, and bundles all look consistent (${catalogModelCount} catalog models should be listed). If the picker is still empty, capture ~/.cache/codex-desktop/launcher.log while opening it.`);
} else {
  console.log(`${failures} failure(s), ${warnings} warning(s) — fix the FAIL lines above, rebuild (./install.sh <dmg> or make build-app && make package && make install), then re-run this doctor.`);
}
process.exit(failures === 0 ? 0 : 1);
