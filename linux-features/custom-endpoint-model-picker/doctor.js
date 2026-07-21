#!/usr/bin/env node
"use strict";

// Diagnose the custom-endpoint-model-picker feature against an INSTALLED app.
//
// Usage:
//   node linux-features/custom-endpoint-model-picker/doctor.js [--install-dir codex-app]
//   node linux-features/custom-endpoint-model-picker/doctor.js --extracted /path/to/extracted-app
//
// Checks, in order:
//   1. config.toml + optional model catalog fallback
//   2. patch-report.json descriptor statuses from the last build
//   3. the app.asar main bundle: current listModels patch state
//   4. exact current webview asset routes and runtime markers
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
    info(`${configPath}: no model_catalog_json key; app-server model/list remains the primary model source`);
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
  warn(`cannot read ${configPath}: ${error.message}`);
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
    "feature:custom-endpoint-model-picker:composer-menu-models",
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
  const v0 = internals.MAIN_LIST_MODELS_NEEDLE.test(source);
  const uuidVar = source.match(/`model\/list:\$\{\(0,(\w+)\.randomUUID\)\(\)\}`/)?.[1];
  info(`bridge chunk: ${name}${uuidVar ? ` (randomUUID module var: ${uuidVar})` : ""}`);
  if (appliedV3 && helperV3) {
    pass(`current patch applied (helper + rewritten listModels)`);
  } else if (v0) {
    fail(`listModels is PRISTINE upstream — the catalog merge patch is not applied; rebuild with the feature enabled`);
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
  const sources = assets.map((name) => ({
    name,
    source: fs.readFileSync(path.join(webviewAssetsDir, name), "utf8"),
  }));
  const pickerComponents = sources.filter(({ source }) =>
    /function \w+\(\{authMethod:\w+,availableModels:\w+,defaultModel:\w+,enabledReasoningEfforts:\w+,includeUltraReasoningEffort:\w+,models:\w+,useHiddenModels:\w+\}\)/.test(source),
  );
  if (pickerComponents.length === 0) {
    fail(`no current model-picker component found by content`);
  }
  for (const { name, source } of pickerComponents) {
    if (!internals.MODEL_PICKER_ASSET_PATTERN.test(name)) {
      fail(`${name}: contains the current picker component but is outside the descriptor route`);
      continue;
    }
    pass(`${name}: current picker component is inside the exact descriptor route`);
    if (internals.PICKER_NEEDLE.test(source)) {
      fail(`${name}: custom-endpoint allowlist guard is still active`);
    } else if (!source.includes(internals.PICKER_ALLOWLIST_MARKER)) {
      fail(`${name}: allowlist marker missing; the current guard shape may have drifted`);
    } else {
      pass(`${name}: custom-endpoint allowlist disabled`);
    }
    if (source.includes(internals.PICKER_ULTRA_MARKER)) pass(`${name}: custom-endpoint Ultra gate enabled`);
    else fail(`${name}: custom-endpoint Ultra marker missing`);
    if (source.includes(internals.PICKER_REASONING_FALLBACK_MARKER)) pass(`${name}: reasoning-effort fallback present`);
    else fail(`${name}: reasoning-effort fallback missing`);
  }

  const composerChunks = sources.filter(({ name }) => internals.COMPOSER_MENU_ASSET_PATTERN.test(name));
  if (composerChunks.length !== 1) {
    fail(`expected exactly one current composer model-menu chunk, found ${composerChunks.length}`);
  } else if (catalogModelCount > 0) {
    if (composerChunks[0].source.includes(internals.PICKER_COMPOSER_MENU_MARKER)) {
      pass(`${composerChunks[0].name}: catalog models injected into composer menu`);
    } else {
      fail(`${composerChunks[0].name}: configured catalog was not injected; rebuild after configuring model_catalog_json`);
    }
  } else {
    info(`${composerChunks[0].name}: no local catalog configured; composer uses app-server model/list`);
  }
} catch (error) {
  fail(`cannot read webview assets: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

section("verdict");
if (failures === 0) {
  console.log(`OK — current model bridge and exact webview routes are consistent (${catalogModelCount} local catalog fallback models). If the picker is still empty, capture ~/.cache/codex-desktop/launcher.log while opening it.`);
} else {
  console.log(`${failures} failure(s), ${warnings} warning(s) — fix the FAIL lines above, rebuild (./install.sh <dmg> or make build-app && make package && make install), then re-run this doctor.`);
}
process.exit(failures === 0 ? 0 : 1);
