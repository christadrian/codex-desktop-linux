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
  applySidebarProviderFilterPatch,
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

const pickerFixture =
  'function init(){let e=n.useHiddenModels&&t!==`amazonBedrock`,r=[{name:"foo"}];r.forEach(console.log)}';
const pickerPatched =
  'function init(){let e=!1,r=[{name:"foo"}];r.forEach(console.log)}';
const currentPickerFixture =
  'function vbe({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=o&&e!==`amazonBedrock`,u=a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`max`)),d=i&&a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`ultra`));return a.forEach(n=>{if(l?t.has(n.model):!n.hidden){s.push(n)}}),{models:s,defaultModel:c}}';
const currentPickerPatched =
  'function vbe({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=!1,u=a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`max`)),d=i&&a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`ultra`));return a.forEach(n=>{if(l?t.has(n.model):!n.hidden){s.push(n)}}),{models:s,defaultModel:c}}';
const dynamicConfigFixture =
  'function cMt(e){let t=Wu(K()).safeParse(e.available_models),n=zu().safeParse(e.use_hidden_models),r=K().safeParse(e.default_model);return{availableModels:new Set(t.success?t.data:vq),useHiddenModels:n.success?n.data:yq.useHiddenModels,defaultModel:r.success?r.data:yq.defaultModel}}';

const sidebarFixture =
  'listRecentThreads({cursor:e,limit:t}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:null,archived:!1,sourceKinds:s})}';
const sidebarPatched =
  'listRecentThreads({cursor:e,limit:t}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:[],archived:!1,sourceKinds:s})}';
const sidebarStateDbOnlyFixture =
  'listRecentThreads({cursor:e,limit:t,useStateDbOnly:n=!0}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:null,archived:!1,sourceKinds:s,useStateDbOnly:n})}';
const sidebarStateDbOnlyPatched =
  'listRecentThreads({cursor:e,limit:t,useStateDbOnly:n=!0}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:[],archived:!1,sourceKinds:s,useStateDbOnly:n})}';
const currentSidebarFixture =
  'async runRecentConversationRefresh(){let s=await this.listRecentThreads({limit:a,cursor:null,useStateDbOnly:i});let c=s.data;if(i){}}async listRecentThreads({cursor:e,limit:t,useStateDbOnly:n=!1}){let r={limit:t,cursor:e,sortKey:this.params.requestClient.getCompatibleThreadSortKey(this.recentConversationSortKey),modelProviders:null,archived:!1,sourceKinds:oh,useStateDbOnly:n};return this.params.requestClient.sendRequest(`thread/list`,r)}';
const currentSidebarPatched =
  'async runRecentConversationRefresh(){let s=await this.listRecentThreads({limit:a,cursor:null,useStateDbOnly:i});let c=s.data.filter(e=>e.name?.trim());if(i){}}async listRecentThreads({cursor:e,limit:t,useStateDbOnly:n=!1}){let r={limit:t,cursor:e,sortKey:this.params.requestClient.getCompatibleThreadSortKey(this.recentConversationSortKey),modelProviders:[],archived:!1,sourceKinds:[],useStateDbOnly:n};return this.params.requestClient.sendRequest(`thread/list`,r)}';
const mainBundleFixture =
  'var nB=class{async getUserSavedConfiguration(e){return(await this.readConfig({includeLayers:!1,cwd:e??null})).config}async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}async startThread(e){}}';

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

function withEmptyCodexHome(fn) {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-empty-home-"));
  const originalCodexHome = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = codexHome;
    return fn();
  } finally {
    if (originalCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
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

test("model picker allowlist patch applies and is idempotent", () => {
  const patched = applyPatchTwice(applyModelPickerAllowlistPatch, pickerFixture);
  assert.equal(patched, pickerPatched);
});

test("main bundle patch merges model_catalog_json models into model/list", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-catalog-"));
  const catalogPath = path.join(tempDir, "catalog.json");
  try {
    fs.writeFileSync(
      catalogPath,
      JSON.stringify([
        {
          slug: "cx/gpt-5.5",
          display_name: "GPT-5.5",
          description: "Custom model",
          visibility: "list",
          default_reasoning_level: "medium",
          supported_reasoning_levels: [{ effort: "medium", description: "Medium" }],
        },
      ]),
    );
    const patched = applyPatchTwice(applyMainBundleCatalogModelsPatch, mainBundleFixture);
    assert.match(patched, /__codexLinuxMergeCustomEndpointCatalogModels/);

    new vm.Script(patched);
    const helperSource = `let ${patched.match(/__codexLinuxMergeCustomEndpointCatalogModels=function[\s\S]+?,nB=class/)?.[0].replace(/,nB=class$/, "")};return __codexLinuxMergeCustomEndpointCatalogModels`;
    const merge = Function("require", helperSource)(require);
    const result = merge({ data: [] }, { model_catalog_json: catalogPath, model: "cx/gpt-5.5" });
    assert.deepEqual(result.data, [
      {
        model: "cx/gpt-5.5",
        name: "GPT-5.5",
        displayName: "GPT-5.5",
        description: "Custom model",
        hidden: false,
        isDefault: true,
        defaultReasoningEffort: "medium",
        supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
      },
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("main bundle patch falls back to CODEX_HOME config.toml", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-home-"));
  const catalogPath = path.join(codexHome, "catalog.json");
  const originalCodexHome = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = codexHome;
    fs.writeFileSync(
      path.join(codexHome, "config.toml"),
      `model_catalog_json = "${catalogPath}"\nmodel = "cx/gpt-5.5"\n`,
    );
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({
        models: [
          {
            slug: "cx/gpt-5.5",
            display_name: "GPT-5.5",
            supported_reasoning_levels: [{ effort: "medium" }],
          },
        ],
      }),
    );
    const patched = applyPatchTwice(applyMainBundleCatalogModelsPatch, mainBundleFixture);
    const helperSource = `let ${patched.match(/__codexLinuxMergeCustomEndpointCatalogModels=function[\s\S]+?,nB=class/)?.[0].replace(/,nB=class$/, "")};return __codexLinuxMergeCustomEndpointCatalogModels`;
    const merge = Function("require", "process", helperSource)(require, process);
    assert.equal(merge({ data: [] }, {}).data[0].model, "cx/gpt-5.5");
  } finally {
    if (originalCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
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
    assert.match(patched, /__codexLinuxMergeCustomEndpointCatalogModels/);
    new vm.Script(patched);
  } finally {
    fs.rmSync(tempApp, { recursive: true, force: true });
  }
});

test("model picker allowlist patch applies to current model-list-filter bundle", () => {
  const patched = applyPatchTwice(applyModelPickerAllowlistPatch, currentPickerFixture);
  assert.equal(patched, currentPickerPatched);
});

test("model picker patch injects catalog fallback from CODEX_HOME", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-webview-home-"));
  const catalogPath = path.join(codexHome, "catalog.json");
  const originalCodexHome = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = codexHome;
    fs.writeFileSync(path.join(codexHome, "config.toml"), `model_catalog_json = "${catalogPath}"\nmodel = "cx/gpt-5.5"\n`);
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({ models: [{ slug: "cx/gpt-5.5", display_name: "GPT-5.5", supported_reasoning_levels: [{ effort: "medium" }] }] }),
    );
    const patched = applyModelPickerAllowlistPatch(currentPickerFixture);
    assert.match(patched, /__codexLinuxCustomEndpointWebviewModels/);
    assert.match(patched, /cx\/gpt-5\.5/);
    assert.equal(applyModelPickerAllowlistPatch(patched), patched);
  } finally {
    if (originalCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
});

test("model picker patch injects catalog into dynamic available_models config", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-custom-endpoint-dynamic-home-"));
  const catalogPath = path.join(codexHome, "catalog.json");
  const originalCodexHome = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = codexHome;
    fs.writeFileSync(path.join(codexHome, "config.toml"), `model_catalog_json = "${catalogPath}"\nmodel = "cx/gpt-5.5"\n`);
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({ models: [{ slug: "cx/gpt-5.5", display_name: "GPT-5.5", supported_reasoning_levels: [{ effort: "medium" }] }] }),
    );
    const patched = applyModelPickerAllowlistPatch(dynamicConfigFixture);
    assert.match(patched, /__codexLinuxCustomEndpointDynamicConfigModels/);
    assert.match(patched, /cx\/gpt-5\.5/);
    assert.equal(applyModelPickerAllowlistPatch(patched), patched);
    new vm.Script(patched);
  } finally {
    if (originalCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
});

test("sidebar provider filter patch applies and is idempotent", () => {
  const patched = applyPatchTwice(applySidebarProviderFilterPatch, sidebarFixture);
  assert.equal(patched, sidebarPatched);
});

test("sidebar provider filter patch preserves useStateDbOnly", () => {
  const patched = applyPatchTwice(applySidebarProviderFilterPatch, sidebarStateDbOnlyFixture);
  assert.equal(patched, sidebarStateDbOnlyPatched);
});

test("sidebar provider filter patch uses server defaults in async state-DB loader", () => {
  const patched = applyPatchTwice(applySidebarProviderFilterPatch, currentSidebarFixture);
  assert.equal(patched, currentSidebarPatched);
  // modelProviders [] restores all-provider history.
  assert.match(patched, /modelProviders:\[\]/);
  // sourceKinds [] lets app-server use default interactive sources.
  assert.match(patched, /sourceKinds:\[\]/);
});

test("sidebar provider filter patch is idempotent on already-patched async loader", () => {
  const once = applySidebarProviderFilterPatch(currentSidebarFixture);
  const twice = applySidebarProviderFilterPatch(once);
  assert.equal(once, twice);
});

test("model picker patch ignores unrelated false forEach markers", () => {
  const source = `function other(){let z=!1,r=[];r.forEach(console.log)}${pickerFixture}`;
  const patched = applyPatchTwice(applyModelPickerAllowlistPatch, source);
  assert.equal(patched, `function other(){let z=!1,r=[];r.forEach(console.log)}${pickerPatched}`);
});

test("patches warn and no-op when needle is missing", () => {
  const pickerMissing =
    'function vbe({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=o&&e!==`amazonBedrock`&&extra;return a.forEach(n=>{s.push(n)}),{models:s,defaultModel:c}}';
  const { value: pickerValue, warnings: pickerWarnings } = withEmptyCodexHome(() =>
    captureWarns(() => applyModelPickerAllowlistPatch(pickerMissing)),
  );
  assert.equal(pickerValue, pickerMissing);
  assert.equal(pickerWarnings.length, 1);
  assert.match(pickerWarnings[0], /allowlist guard/);

  const sidebarMissing =
    'listRecentThreads({cursor:e,limit:t}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:null,archived:!1,sourceKinds:s,extra:1})}';
  const { value: sidebarValue, warnings: sidebarWarnings } = captureWarns(() =>
    applySidebarProviderFilterPatch(sidebarMissing),
  );
  assert.equal(sidebarValue, sidebarMissing);
  assert.equal(sidebarWarnings.length, 1);
  assert.match(sidebarWarnings[0], /sidebar provider filter/);
});

test("patches no-op silently on unrelated source", () => {
  const { value: pickerValue, warnings: pickerWarnings } = captureWarns(() =>
    applyModelPickerAllowlistPatch("console.log('hello')"),
  );
  assert.equal(pickerValue, "console.log('hello')");
  assert.equal(pickerWarnings.length, 0);

  const { value: sidebarValue, warnings: sidebarWarnings } = captureWarns(() =>
    applySidebarProviderFilterPatch("function x(){}"),
  );
  assert.equal(sidebarValue, "function x(){}");
  assert.equal(sidebarWarnings.length, 0);
});

test("feature stays disabled until listed in features.json", () => {
  withTempFeatureConfig([], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), []);
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot: root }), []);
  });
});

test("feature exposes two webview-asset descriptors when enabled", () => {
  withTempFeatureConfig(["custom-endpoint-model-picker"], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), ["custom-endpoint-model-picker"]);

    const descriptors = loadLinuxFeaturePatchDescriptors({ featuresRoot: root });
    assert.equal(descriptors.length, 3);
    assert.deepEqual(
      descriptors.map((d) => [d.id, d.phase]),
      [
        ["feature:custom-endpoint-model-picker:main-bundle-catalog-models", "extracted-app:post-webview"],
        ["feature:custom-endpoint-model-picker:model-picker-allowlist", "webview-asset"],
        ["feature:custom-endpoint-model-picker:sidebar-provider-filter", "webview-asset"],
      ],
    );

    assert.equal(descriptors[1].apply(pickerFixture), pickerPatched);
    assert.equal(descriptors[2].apply(sidebarFixture), sidebarPatched);
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
      fs.writeFileSync(path.join(assetsDir, "app-initial~app-main~onboarding-page-ABC.js"), currentPickerFixture);
      fs.writeFileSync(path.join(assetsDir, "app-initial~app-main~worktree-init-v2-page~remote-conversation-page~new-thread-panel-page~XYZ.js"), currentSidebarFixture);

      const report = createPatchReport();
      withEmptyCodexHome(() => captureWarns(() => patchExtractedApp(tempApp, { featuresRoot: root, report })));

      assert.equal(
        fs.readFileSync(path.join(assetsDir, "app-initial~app-main~onboarding-page-ABC.js"), "utf8"),
        currentPickerPatched,
      );
      assert.equal(
        fs.readFileSync(path.join(assetsDir, "app-initial~app-main~worktree-init-v2-page~remote-conversation-page~new-thread-panel-page~XYZ.js"), "utf8"),
        currentSidebarPatched,
      );
      assert.match(
        fs.readFileSync(path.join(buildDir, "src-test.js"), "utf8"),
        /__codexLinuxMergeCustomEndpointCatalogModels/,
      );
      assert.ok(
        report.patches.some(
          (p) =>
            p.name === "feature:custom-endpoint-model-picker:model-picker-allowlist" &&
            p.status === "applied",
        ),
      );
      const sidebarReport = report.patches.find(
        (p) => p.name === "feature:custom-endpoint-model-picker:sidebar-provider-filter",
      );
      assert.ok(sidebarReport);
      assert.ok(["applied", "already-applied"].includes(sidebarReport.status));
    } finally {
      fs.rmSync(tempApp, { recursive: true, force: true });
    }
  });
});
