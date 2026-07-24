#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const {
  descriptors,
  applyMainBundleCatalogModelsPatch,
  applyModelPickerAllowlistPatch,
} = require("./patch.js");

const pickerSource =
  'function Ue({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=o&&e!==`amazonBedrock`,u=a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`max`)),d=i&&a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`ultra`));return a.forEach(n=>{if(l?t.has(n.model)||n.model.startsWith(`gpt-5.6-`)&&!n.hidden:!n.hidden){let t=i?n.supportedReasoningEfforts:n.supportedReasoningEfforts.filter(({reasoningEffort:e})=>e!==`ultra`),a=[...t].filter(({reasoningEffort:e})=>Re(e)&&r.has(e)),o={...n,supportedReasoningEfforts:a,codexLinuxApiKeyServiceTierModel:e===`apikey`};s.push(o),n.isDefault&&(c=o)}}),c??=s.find(e=>e.model===n)??null,{models:s,defaultModel:c,hasModelSupportingMaxReasoningEffort:u,hasModelSupportingUltraReasoningEffort:d}}';
const pickerAsset =
  "app-initial-C-fROkKo.js";
const composerSource =
  'function FP(e){let t=(0,LP.c)(14),{fromModel:n,toModel:r}=e,{data:i}=gr(),a=i?.models,o;t[0]!==n||t[1]!==a?(o=IP(n,a),t[0]=n,t[1]=a,t[2]=o):o=t[2];let s=o,c=i?.models,l;t[3]!==c||t[4]!==r?(l=IP(r,c),t[3]=c,t[4]=r,t[5]=l):l=t[5];return{from:s,to:l}}';
const composerAsset =
  "app-initial-C-fROkKo.js";
const mainSource =
  'var rW=class{async getUserSavedConfiguration(e){return{}}async listModels(e){await this.ensureReady();let t=`model/list:${(0,c.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}}';

function withCatalog(fn) {
  const previous = process.env.CODEX_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-model-picker-eval-"));
  const catalogPath = path.join(home, "catalog.json");
  process.env.CODEX_HOME = home;
  fs.writeFileSync(path.join(home, "config.toml"), `model_catalog_json = "${catalogPath}"\n`);
  fs.writeFileSync(catalogPath, JSON.stringify({
    models: [{
      slug: "cx/eval-model",
      display_name: "Eval Model",
      supported_reasoning_levels: [{ effort: "medium" }],
    }],
  }));
  try {
    return fn();
  } finally {
    previous == null ? delete process.env.CODEX_HOME : process.env.CODEX_HOME = previous;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

const scenarios = [
  {
    name: "exact current picker and composer bundles are routed",
    run() {
      assert.match(pickerAsset, descriptors.find((entry) => entry.id === "model-picker-allowlist").pattern);
      assert.match(composerAsset, descriptors.find((entry) => entry.id === "composer-menu-models").pattern);
      assert.doesNotMatch("app-initial~app-main~onboarding-page-old.js", descriptors[1].pattern);
      assert.doesNotMatch(
        "app-initial-C-fROkKo.js",
        descriptors.find((entry) => entry.id === "composer-menu-models").pattern,
      );
    },
  },
  {
    name: "current picker keeps custom models and their reasoning efforts",
    run() {
      for (const functionName of ["Ue", "Ze"]) {
        const source = pickerSource.replace("function Ue", `function ${functionName}`);
        const patched = applyModelPickerAllowlistPatch(source);
        assert.match(patched, /__codexLinuxCustomEndpointAllowlist/);
        assert.match(patched, /__codexLinuxCustomEndpointReasoningFallback/);
        assert.equal(applyModelPickerAllowlistPatch(patched), patched);
        const picker = vm.runInNewContext(`${patched};${functionName}`, {
          Re: (effort) => ["medium", "ultra"].includes(effort),
        });
        const result = picker({
          authMethod: "apikey",
          availableModels: new Set(),
          defaultModel: "custom/model",
          enabledReasoningEfforts: new Set(),
          includeUltraReasoningEffort: false,
          models: [{
            model: "custom/model",
            hidden: false,
            supportedReasoningEfforts: [
              { reasoningEffort: "medium" },
              { reasoningEffort: "ultra" },
            ],
          }],
          useHiddenModels: true,
        });
        const customModel = result.models.find((model) => model.model === "custom/model");
        assert.ok(customModel);
        assert.deepEqual(
          Array.from(customModel.supportedReasoningEfforts, (effort) => effort.reasoningEffort),
          ["medium", "ultra"],
        );
        assert.equal(result.hasModelSupportingUltraReasoningEffort, true);
      }
    },
  },
  {
    name: "current composer receives catalog fallback models",
    run() {
      withCatalog(() => {
        const patched = applyModelPickerAllowlistPatch(composerSource);
        assert.match(patched, /__codexLinuxCustomEndpointComposerMenuModels/);
        assert.match(patched, /cx\/eval-model/);
        assert.equal(applyModelPickerAllowlistPatch(patched), patched);
        new vm.Script(patched);
      });
    },
  },
  {
    name: "current app-server model bridge merges catalog fallback",
    run() {
      const patched = applyMainBundleCatalogModelsPatch(mainSource);
      assert.match(patched, /__codexLinuxMergeCustomEndpointCatalogModelsV3/);
      assert.match(patched, /__cdlxCfg/);
      assert.match(patched, /model_catalog_json/);
      assert.match(patched, /\(0,c\.randomUUID\)/);
      assert.equal(applyMainBundleCatalogModelsPatch(patched), patched);
      new vm.Script(patched);
    },
  },
  {
    name: "catalog order stays ahead of provider-only rows",
    run() {
      const patched = applyMainBundleCatalogModelsPatch(mainSource);
      assert.match(patched, /let z=\[\];for\(let\[g,m\]of f\)z\.push\(m\)/);
      assert.match(patched, /if\(!f\.has\(g\)\)z\.push\(m\)/);
    },
  },
  {
    name: "current picker drift emits a warning",
    run() {
      const drifted = pickerSource.replace("l=o&&e!==`amazonBedrock`", "l=o&&e!==`amazonBedrock`&&unknown");
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(" "));
      try {
        assert.notEqual(applyModelPickerAllowlistPatch(drifted), pickerSource);
      } finally {
        console.warn = originalWarn;
      }
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /allowlist guard/);
    },
  },
];

let failed = 0;
for (const scenario of scenarios) {
  try {
    scenario.run();
    console.log(`ok - ${scenario.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${scenario.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`${failed}/${scenarios.length} custom-endpoint-model-picker eval scenarios failed`);
  process.exit(1);
}

console.log(`${scenarios.length}/${scenarios.length} current custom-endpoint-model-picker eval scenarios passed`);
