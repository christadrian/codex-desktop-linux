#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  applyMainBundleCatalogModelsPatch,
  applyExtractedAppCatalogModelsPatch,
  applyModelPickerAllowlistPatch,
} = require("./patch.js");
const {
  enabledLinuxFeatureIds,
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");
const {
  createPatchReport,
} = require("../../scripts/lib/patch-report.js");
const {
  patchExtractedApp,
} = require("../../scripts/patches/runner.js");

const currentPickerFixture =
  'function vbe({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=o&&e!==`amazonBedrock`,u=a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`max`)),d=i&&a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`ultra`));return a.forEach(n=>{if(l?t.has(n.model)||n.model.startsWith(`gpt-5.6-`)&&!n.hidden:!n.hidden){let t=i?n.supportedReasoningEfforts:n.supportedReasoningEfforts.filter(({reasoningEffort:e})=>e!==`ultra`),a=[...t].filter(({reasoningEffort:e})=>Re(e)&&r.has(e)),o={...n,supportedReasoningEfforts:a,codexLinuxApiKeyServiceTierModel:e===`apikey`};s.push(o),n.isDefault&&(c=o)}}),c??=s.find(e=>e.model===n)??null,{models:s,defaultModel:c,hasModelSupportingMaxReasoningEffort:u,hasModelSupportingUltraReasoningEffort:d}}';
const latestPickerFixture =
  currentPickerFixture.replace("function vbe", "function Ue");
const latestPickerAsset =
  'app-initial~avatarOverlayCompositionSurface~artifact-tab-content.electron~app-main~plugin-d~kw7nl1sl-Dt2LYVtU.js';
const dynamicConfigFixture =
  'function cMt(e){let t=Wu(K()).safeParse(e.available_models),n=zu().safeParse(e.use_hidden_models),r=K().safeParse(e.default_model);return{availableModels:new Set(t.success?t.data:vq),useHiddenModels:n.success?n.data:yq.useHiddenModels,defaultModel:r.success?r.data:yq.defaultModel}}';
const composerMenuFixture =
  'function FP(e){let t=(0,LP.c)(14),{fromModel:n,toModel:r}=e,{data:i}=gr(),a=i?.models,o;t[0]!==n||t[1]!==a?(o=IP(n,a),t[0]=n,t[1]=a,t[2]=o):o=t[2];let s=o,c=i?.models,l;t[3]!==c||t[4]!==r?(l=IP(r,c),t[3]=c,t[4]=r,t[5]=l):l=t[5];return{from:s,to:l}}';
const composerMenuAsset =
  'app-initial~app-main~onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~c33rimzq-DE26mzOH.js';

const mainBundleFixture =
  'var nB=class{async getUserSavedConfiguration(e){return(await this.readConfig({includeLayers:!1,cwd:e??null})).config}async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}async startThread(e){}}';
// Same shape, but the minifier picked a different randomUUID module var.
const mainBundleUuidVariantFixture =
  'var nB=class{async getUserSavedConfiguration(e){return{}}async listModels(e){await this.ensureReady();let t=`model/list:${(0,c.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}async startThread(e){}}';
// Same shape, but the request-id/response vars collide with naive replacement locals.
const mainBundleIdCollisionFixture =
  'var nB=class{async getUserSavedConfiguration(e){return{}}async listModels(e){await this.ensureReady();let n=`model/list:${(0,o.randomUUID)()}`,r=await this.sendInternalRequest({id:n,method:`model/list`,params:e});if(r.error)throw Error(r.error.message??`Failed to read available models`);return r.result}async startThread(e){}}';
// Renamed class behind a "use strict" directive — no nB anchor available.
const mainBundleStrictRenamedFixture =
  '"use strict";var rW=class{async getUserSavedConfiguration(e){return{}}async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}async startThread(e){}}';
const catalogFixture = {
  models: [
    {
      slug: "cx/gpt-5.5",
      display_name: "GPT-5.5",
      description: "Custom model",
      default_reasoning_level: "medium",
      supported_reasoning_levels: [{ effort: "medium", description: "Medium" }],
    },
    {
      slug: "ocg/glm-5",
      display_name: "GLM 5",
      supported_reasoning_levels: [{ effort: "high" }],
    },
  ],
};

const orderedCatalogFixture = {
  models: [
    { slug: "cx/gpt-5.6-terra", display_name: "GPT-5.6 Terra", supported_reasoning_levels: [{ effort: "medium" }] },
    { slug: "cx/gpt-5.6-luna", display_name: "GPT-5.6 Luna", supported_reasoning_levels: [{ effort: "medium" }] },
    { slug: "cx/gpt-5.5", display_name: "GPT-5.5", supported_reasoning_levels: [{ effort: "medium" }] },
  ],
};

function withTempFeatureConfig(enabled, fn) {
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-model-picker-"));
  const root = path.join(tempDir, "linux-features");
  fs.cpSync(__dirname, path.join(root, "custom-endpoint-model-picker"), { recursive: true });
  process.env.CODEX_LINUX_FEATURES_CONFIG = path.join(root, "features.json");
  try {
    fs.writeFileSync(process.env.CODEX_LINUX_FEATURES_CONFIG, JSON.stringify({ enabled }, null, 2));
    return fn(root);
  } finally {
    if (originalConfig == null) {
      delete process.env.CODEX_LINUX_FEATURES_CONFIG;
    } else {
      process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function captureWarns(fn) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    return { value: fn(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function runWithCleanup(fn, args, cleanup) {
  let result;
  try {
    result = fn(...args);
  } catch (error) {
    cleanup();
    throw error;
  }
  if (result != null && typeof result.then === "function") {
    return result.finally(cleanup);
  }
  cleanup();
  return result;
}

function withEmptyCodexHome(fn) {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-empty-home-"));
  const originalCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  return runWithCleanup(fn, [], () => {
    if (originalCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    fs.rmSync(codexHome, { recursive: true, force: true });
  });
}

function withCatalogCodexHome(catalog, fn) {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-catalog-home-"));
  const catalogPath = path.join(codexHome, "catalog.json");
  const originalCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  fs.writeFileSync(path.join(codexHome, "config.toml"), `model_catalog_json = "${catalogPath}"\nmodel = "cx/gpt-5.5"\n`);
  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  return runWithCleanup(fn, [codexHome, catalogPath], () => {
    if (originalCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    fs.rmSync(codexHome, { recursive: true, force: true });
  });
}

function applyPatchTwice(patchFn, source) {
  if (patchFn === applyModelPickerAllowlistPatch) {
    return withEmptyCodexHome(() => {
      const patched = patchFn(source);
      assert.equal(patchFn(patched), patched);
      return patched;
    });
  }
  const patched = patchFn(source);
  assert.equal(patchFn(patched), patched);
  return patched;
}

function instantiatePatchedClient(patched, { className = "nB", uuidVar = "o" } = {}) {
  const context = { require, process };
  context[uuidVar] = { randomUUID: () => "test-id" };
  const ModelClient = vm.runInNewContext(`${patched};${className}`, context);
  return new ModelClient();
}

// ---------------------------------------------------------------------------
// Webview allowlist patch
// ---------------------------------------------------------------------------

test("model picker patch targets and preserves models in the latest picker bundle", () => {
  const descriptor = require("./patch.js").descriptors.find((entry) => entry.id === "model-picker-allowlist");
  assert.match(latestPickerAsset, descriptor.pattern);

  const patched = applyPatchTwice(applyModelPickerAllowlistPatch, latestPickerFixture);
  assert.match(patched, /__codexLinuxCustomEndpointReasoningFallback/);
  assert.doesNotMatch(patched, /l=o&&e!==`amazonBedrock`/);
  const Ue = vm.runInNewContext(`${patched};Ue`, {
    Re: (effort) => ["low", "medium", "high", "ultra"].includes(effort),
  });
  const result = Ue({
    authMethod: "apikey",
    availableModels: new Set(),
    defaultModel: "custom/model",
    enabledReasoningEfforts: new Set(),
    includeUltraReasoningEffort: false,
    models: [{
      model: "custom/model",
      hidden: false,
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
    }],
    useHiddenModels: true,
  });
  assert.equal(result.models[0].model, "custom/model");
  assert.equal(result.models[0].supportedReasoningEfforts[0].reasoningEffort, "medium");
});

test("model picker patch injects catalog fallback from CODEX_HOME", () => {
  withCatalogCodexHome(catalogFixture, () => {
    const patched = applyModelPickerAllowlistPatch(currentPickerFixture);
    assert.match(patched, /__codexLinuxCustomEndpointWebviewModels/);
    assert.match(patched, /cx\/gpt-5\.5/);
    // Re-patching an injected+guard-disabled chunk (stale rebuild) must be a
    // silent no-op, not a drift warning.
    const { value: repatched, warnings } = captureWarns(() => applyModelPickerAllowlistPatch(patched));
    assert.equal(repatched, patched);
    assert.equal(warnings.length, 0);
    new vm.Script(patched);
  });
});

test("model picker patch injects catalog into dynamic available_models config", () => {
  withCatalogCodexHome(catalogFixture, () => {
    const patched = applyModelPickerAllowlistPatch(dynamicConfigFixture);
    assert.match(patched, /__codexLinuxCustomEndpointDynamicConfigModels/);
    assert.match(patched, /cx\/gpt-5\.5/);
    assert.equal(applyModelPickerAllowlistPatch(patched), patched);
    new vm.Script(patched);
  });
});

test("model picker patch injects catalog into composer menu models", () => {
  withCatalogCodexHome(catalogFixture, () => {
    const descriptor = require("./patch.js").descriptors.find((entry) => entry.id === "composer-menu-models");
    assert.match(composerMenuAsset, descriptor.pattern);
    assert.doesNotMatch(
      "app-initial~app-main~onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~b1ew1ta1-hVZZ2amZ.js",
      descriptor.pattern,
    );
    const patched = applyModelPickerAllowlistPatch(composerMenuFixture);
    assert.match(patched, /__codexLinuxCustomEndpointComposerMenuModels/);
    assert.match(patched, /cx\/gpt-5\.5/);
    assert.equal(applyModelPickerAllowlistPatch(patched), patched);
    new vm.Script(patched);
  });
});

test("model picker patch drops raw provider models that would crash current selector", () => {
  withCatalogCodexHome(catalogFixture, () => {
    const patched = applyModelPickerAllowlistPatch(currentPickerFixture);
    const vbe = vm.runInNewContext(`${patched};vbe`, { Re: (effort) => ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].includes(effort) });
    const result = vbe({
      authMethod: "apiKey",
      availableModels: new Set(),
      defaultModel: null,
      enabledReasoningEfforts: new Set(),
      includeUltraReasoningEffort: true,
      // Raw provider rows: one without effort metadata (previously crashed
      // `models.some(m=>m.supportedReasoningEfforts.some(...))`), one duplicate
      // of a catalog slug.
      models: [{ model: "cx/gpt-5.5" }, { model: "raw/unlisted" }],
      useHiddenModels: true,
    });
    assert.ok(result.models.length >= 2);
    for (const model of result.models) {
      assert.ok(Array.isArray(model.supportedReasoningEfforts), `model ${model.model} must have efforts`);
    }
    const gpt = result.models.find((model) => model.model === "cx/gpt-5.5");
    assert.equal(gpt.displayName, "GPT-5.5");
    assert.equal(gpt.supportedReasoningEfforts.map((effort) => effort.reasoningEffort).join(","), "medium");
  });
});

test("model picker keeps catalog model efforts when enabled-effort filter is empty", () => {
  withCatalogCodexHome(catalogFixture, () => {
    const patched = applyModelPickerAllowlistPatch(currentPickerFixture);
    const vbe = vm.runInNewContext(`${patched};vbe`, { Re: (effort) => ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].includes(effort) });
    const result = vbe({
      authMethod: "apiKey",
      availableModels: new Set(),
      defaultModel: null,
      enabledReasoningEfforts: new Set(),
      includeUltraReasoningEffort: true,
      models: [],
      useHiddenModels: false,
    });
    assert.ok(result.models.some((model) => model.model === "cx/gpt-5.5"));
    assert.ok(result.models.every((model) => model.supportedReasoningEfforts.length > 0));
  });
});

test("model picker exposes ultra for a custom endpoint", () => {
  const patched = applyPatchTwice(applyModelPickerAllowlistPatch, currentPickerFixture);
  const vbe = vm.runInNewContext(`${patched};vbe`, {
    Re: (effort) => ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].includes(effort),
  });
  const result = vbe({
    authMethod: "apikey",
    availableModels: new Set(),
    defaultModel: null,
    enabledReasoningEfforts: new Set(["medium", "ultra"]),
    includeUltraReasoningEffort: false,
    models: [{
      model: "cx/gpt-5.6-sol",
      hidden: false,
      supportedReasoningEfforts: [
        { reasoningEffort: "medium", description: "Medium" },
        { reasoningEffort: "ultra", description: "Ultra" },
      ],
    }],
    useHiddenModels: false,
  });
  assert.deepEqual(
    Array.from(result.models[0].supportedReasoningEfforts, (effort) => effort.reasoningEffort),
    ["medium", "ultra"],
  );
});

// ---------------------------------------------------------------------------
// Main-bundle catalog patch
// ---------------------------------------------------------------------------

test("main bundle patch merges catalog and normalizes raw provider rows", async () => {
  const patched = applyPatchTwice(applyMainBundleCatalogModelsPatch, mainBundleFixture);
  assert.match(patched, /__codexLinuxMergeCustomEndpointCatalogModelsV3/);
  assert.match(patched, /__cdlxCfg/);
  new vm.Script(patched);

  await withCatalogCodexHome(catalogFixture, async (codexHome, catalogPath) => {
    const client = instantiatePatchedClient(patched);
    client.ensureReady = async () => {};
    client.sendInternalRequest = async () => ({
      result: {
        data: [
          { model: "cx/gpt-5.5" },
          "ocg/raw-slug",
          { model: "provider-only", supportedReasoningEfforts: [{ reasoningEffort: "low", description: "Low" }] },
        ],
      },
    });
    client.getUserSavedConfiguration = async () => ({ model_catalog_json: catalogPath, model: "cx/gpt-5.5" });
    const { data } = await client.listModels({});

    assert.deepEqual(Array.from(data, (model) => model.model), ["cx/gpt-5.5", "ocg/glm-5", "ocg/raw-slug", "provider-only"]);
    for (const model of data) {
      assert.ok(Array.isArray(model.supportedReasoningEfforts) && model.supportedReasoningEfforts.length > 0);
    }
    const gpt = data.find((model) => model.model === "cx/gpt-5.5");
    // Catalog wins over the raw provider row with the same slug.
    assert.equal(gpt.displayName, "GPT-5.5");
    assert.equal(gpt.isDefault, true);
    assert.equal(gpt.supportedReasoningEfforts[0].reasoningEffort, "medium");
    const rawSlug = data.find((model) => model.model === "ocg/raw-slug");
    assert.equal(rawSlug.displayName, "ocg/raw-slug");
    const providerOnly = data.find((model) => model.model === "provider-only");
    assert.equal(providerOnly.supportedReasoningEfforts[0].description, "Low");
  });
});

test("main bundle patch keeps catalog order ahead of provider-only rows", async () => {
  const patched = applyMainBundleCatalogModelsPatch(mainBundleFixture);
  await withCatalogCodexHome(orderedCatalogFixture, async (codexHome, catalogPath) => {
    const client = instantiatePatchedClient(patched);
    client.ensureReady = async () => {};
    client.sendInternalRequest = async () => ({ result: { data: [{ model: "provider-only" }] } });
    client.getUserSavedConfiguration = async () => ({ model_catalog_json: catalogPath });
    const { data } = await client.listModels({});
    assert.deepEqual(
      Array.from(data, (model) => model.model),
      ["cx/gpt-5.6-terra", "cx/gpt-5.6-luna", "cx/gpt-5.5", "provider-only"],
    );
  });
});

test("main bundle patch falls back to CODEX_HOME config.toml", async () => {
  const patched = applyMainBundleCatalogModelsPatch(mainBundleFixture);
  await withCatalogCodexHome(catalogFixture, async () => {
    const client = instantiatePatchedClient(patched);
    client.ensureReady = async () => {};
    client.sendInternalRequest = async () => ({ result: { data: [] } });
    client.getUserSavedConfiguration = async () => ({});
    const { data } = await client.listModels({});
    assert.equal(data[0].model, "cx/gpt-5.5");
    assert.equal(data[0].isDefault, true);
  });
});

test("main bundle helper expands ~ paths and single-quoted config values", async () => {
  const patched = applyMainBundleCatalogModelsPatch(mainBundleFixture);
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-tilde-home-"));
  const originalHome = process.env.HOME;
  const originalCodexHome = process.env.CODEX_HOME;
  try {
    process.env.HOME = fakeHome;
    delete process.env.CODEX_HOME;
    fs.mkdirSync(path.join(fakeHome, ".codex"), { recursive: true });
    fs.writeFileSync(path.join(fakeHome, ".codex", "catalog.json"), JSON.stringify(catalogFixture));
    fs.writeFileSync(
      path.join(fakeHome, ".codex", "config.toml"),
      "model_catalog_json = '~/.codex/catalog.json'\nmodel = 'cx/gpt-5.5'\n",
    );
    const client = instantiatePatchedClient(patched);
    client.ensureReady = async () => {};
    client.sendInternalRequest = async () => ({ result: { data: [] } });
    client.getUserSavedConfiguration = async () => ({});
    const { data } = await client.listModels({});
    assert.equal(data[0].model, "cx/gpt-5.5");
  } finally {
    if (originalHome == null) delete process.env.HOME; else process.env.HOME = originalHome;
    if (originalCodexHome == null) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = originalCodexHome;
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
});

test("main bundle patch returns catalog models when provider model/list errors", async () => {
  const patched = applyMainBundleCatalogModelsPatch(mainBundleFixture);
  await withCatalogCodexHome(catalogFixture, async (codexHome, catalogPath) => {
    const client = instantiatePatchedClient(patched);
    client.ensureReady = async () => {};
    client.sendInternalRequest = async () => ({ error: { message: "provider cannot list models" } });
    client.getUserSavedConfiguration = async () => ({ model_catalog_json: catalogPath, model: "cx/gpt-5.5" });
    assert.equal((await client.listModels({})).data[0].model, "cx/gpt-5.5");
  });
  await withEmptyCodexHome(async () => {
    const client = instantiatePatchedClient(patched);
    client.ensureReady = async () => {};
    client.sendInternalRequest = async () => ({ error: { message: "provider cannot list models" } });
    client.getUserSavedConfiguration = async () => ({});
    await assert.rejects(() => client.listModels({}), /provider cannot list models/);
  });
});

test("main bundle patch preserves the bundle's randomUUID module var", () => {
  const patched = applyPatchTwice(applyMainBundleCatalogModelsPatch, mainBundleUuidVariantFixture);
  assert.match(patched, /\(0,c\.randomUUID\)/);
  assert.doesNotMatch(patched, /\(0,o\.randomUUID\)/);
  new vm.Script(patched);
});

test("main bundle patch avoids identifier collisions with minified locals", async () => {
  const patched = applyPatchTwice(applyMainBundleCatalogModelsPatch, mainBundleIdCollisionFixture);
  new vm.Script(patched);
  await withCatalogCodexHome(catalogFixture, async () => {
    const client = instantiatePatchedClient(patched);
    client.ensureReady = async () => {};
    client.sendInternalRequest = async () => ({ result: { data: [] } });
    client.getUserSavedConfiguration = async () => ({});
    const { data } = await client.listModels({});
    assert.equal(data[0].model, "cx/gpt-5.5");
  });
});

test("main bundle patch injects helper without a class-name anchor and after directives", () => {
  const patched = applyPatchTwice(applyMainBundleCatalogModelsPatch, mainBundleStrictRenamedFixture);
  assert.ok(patched.startsWith('"use strict";var __codexLinuxMergeCustomEndpointCatalogModelsV3=function('));
  assert.match(patched, /__cdlxCfg/);
  new vm.Script(patched);
});

test("extracted app patch updates split app-server chunks", () => {
  const tempApp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-model-picker-main-"));
  try {
    const buildDir = path.join(tempApp, ".vite", "build");
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, "main.js"), "console.log('main')");
    fs.writeFileSync(path.join(buildDir, "src-test.js"), mainBundleFixture);
    const result = applyExtractedAppCatalogModelsPatch(tempApp);
    assert.deepEqual(result, { changed: true, matched: 1, changedFiles: 1 });
    const patched = fs.readFileSync(path.join(buildDir, "src-test.js"), "utf8");
    assert.match(patched, /__codexLinuxMergeCustomEndpointCatalogModelsV3/);
    new vm.Script(patched);
  } finally {
    fs.rmSync(tempApp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Drift + wiring
// ---------------------------------------------------------------------------

test("patches warn and no-op when needle is missing", () => {
  const pickerMissing =
    'function vbe({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=o&&e!==`amazonBedrock`&&extra;return a.forEach(n=>{s.push(n)}),{models:s,defaultModel:c}}';
  const { value: pickerValue, warnings: pickerWarnings } = withEmptyCodexHome(() =>
    captureWarns(() => applyModelPickerAllowlistPatch(pickerMissing)),
  );
  assert.equal(pickerValue, pickerMissing);
  assert.equal(pickerWarnings.length, 1);
  assert.match(pickerWarnings[0], /allowlist guard/);

  const mainMissing =
    'var nB=class{async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e,extra:1});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}}';
  const { value: mainValue, warnings: mainWarnings } = captureWarns(() =>
    applyMainBundleCatalogModelsPatch(mainMissing),
  );
  assert.equal(mainValue, mainMissing);
  assert.equal(mainWarnings.length, 1);
  assert.match(mainWarnings[0], /model\/list bridge/);

});

test("patches no-op silently on unrelated source", () => {
  const { value: pickerValue, warnings: pickerWarnings } = captureWarns(() =>
    applyModelPickerAllowlistPatch("console.log('hello')"),
  );
  assert.equal(pickerValue, "console.log('hello')");
  assert.equal(pickerWarnings.length, 0);

  const { value: mainValue, warnings: mainWarnings } = captureWarns(() =>
    applyMainBundleCatalogModelsPatch("function x(){}"),
  );
  assert.equal(mainValue, "function x(){}");
  assert.equal(mainWarnings.length, 0);

});

test("feature stays disabled until listed in features.json", () => {
  withTempFeatureConfig([], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), []);
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot: root }), []);
  });
});

test("feature exposes three descriptors on the current engine contract when enabled", () => {
  withTempFeatureConfig(["custom-endpoint-model-picker"], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), ["custom-endpoint-model-picker"]);

    const descriptors = loadLinuxFeaturePatchDescriptors({ featuresRoot: root });
    assert.equal(descriptors.length, 3);
    assert.deepEqual(
      descriptors.map((d) => [d.id, d.phase]),
      [
        ["feature:custom-endpoint-model-picker:main-bundle-catalog-models", "extracted-app:post-webview"],
        ["feature:custom-endpoint-model-picker:model-picker-allowlist", "webview-asset"],
        ["feature:custom-endpoint-model-picker:composer-menu-models", "webview-asset"],
      ],
    );

    const pickerPatched = withEmptyCodexHome(() => descriptors[1].apply(latestPickerFixture));
    assert.match(pickerPatched, /__codexLinuxCustomEndpointAllowlist/);
    withCatalogCodexHome(catalogFixture, () => {
      assert.match(descriptors[2].apply(composerMenuFixture), /__codexLinuxCustomEndpointComposerMenuModels/);
    });
  });
});

test("feature participates in extracted app patching and patch report", () => {
  withTempFeatureConfig(["custom-endpoint-model-picker"], (root) => {
    const tempApp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-model-picker-app-"));
    try {
      const buildDir = path.join(tempApp, ".vite", "build");
      const assetsDir = path.join(tempApp, "webview", "assets");
      fs.mkdirSync(buildDir, { recursive: true });
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(path.join(tempApp, "package.json"), JSON.stringify({ name: "codex" }));
      fs.writeFileSync(path.join(buildDir, "main.js"), "console.log('main bundle')");
      fs.writeFileSync(path.join(buildDir, "src-test.js"), mainBundleFixture);
      fs.writeFileSync(path.join(assetsDir, "app-test.png"), "");
      fs.writeFileSync(path.join(assetsDir, latestPickerAsset), latestPickerFixture);
      fs.writeFileSync(path.join(assetsDir, composerMenuAsset), composerMenuFixture);

      const report = createPatchReport();
      withCatalogCodexHome(catalogFixture, () =>
        captureWarns(() => patchExtractedApp(tempApp, { featuresRoot: root, report })),
      );

      assert.match(
        fs.readFileSync(path.join(assetsDir, latestPickerAsset), "utf8"),
        /__codexLinuxCustomEndpointAllowlist/,
      );
      assert.match(
        fs.readFileSync(path.join(assetsDir, composerMenuAsset), "utf8"),
        /__codexLinuxCustomEndpointComposerMenuModels/,
      );
      assert.match(
        fs.readFileSync(path.join(buildDir, "src-test.js"), "utf8"),
        /__codexLinuxMergeCustomEndpointCatalogModelsV3/,
      );
      assert.ok(
        report.patches.some(
          (p) =>
            p.name === "feature:custom-endpoint-model-picker:model-picker-allowlist" &&
            p.status === "applied",
        ),
      );
      const mainReport = report.patches.find(
        (p) => p.name === "feature:custom-endpoint-model-picker:main-bundle-catalog-models",
      );
      assert.ok(mainReport);
      assert.ok(["applied", "already-applied"].includes(mainReport.status));
      const composerReport = report.patches.find(
        (p) => p.name === "feature:custom-endpoint-model-picker:composer-menu-models",
      );
      assert.ok(composerReport);
      assert.ok(["applied", "already-applied"].includes(composerReport.status));
    } finally {
      fs.rmSync(tempApp, { recursive: true, force: true });
    }
  });
});
