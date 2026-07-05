#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const {
  descriptors,
  applyMainBundleCatalogModelsPatch,
  applyModelPickerAllowlistPatch,
  applySidebarProviderFilterPatch,
} = require("./patch.js");

const scenarios = [
  {
    name: "custom catalog models flow into model list",
    run() {
      const source = 'var nB=class{async getUserSavedConfiguration(e){return(await this.readConfig({includeLayers:!1,cwd:e??null})).config}async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}async startThread(e){}}';
      const patched = applyMainBundleCatalogModelsPatch(source);
      assert.match(patched, /__codexLinuxMergeCustomEndpointCatalogModelsV3/);
      assert.match(patched, /__cdlxCfg/);
      assert.match(patched, /getUserSavedConfiguration/);
      assert.match(patched, /model_catalog_json/);
      new vm.Script(patched);
    },
  },
  {
    name: "current upstream bundles selected",
    run() {
      assert.match("app-initial~app-main~onboarding-page-BUwCKIcU.js", descriptors[1].pattern);
      assert.match(
        "app-initial~app-main~worktree-init-v2-page~remote-conversation-page~new-thread-panel-page~o~bj5tp28r-Dcs9S3fj.js",
        descriptors[1].pattern,
      );
      assert.match(
        "app-initial~app-main~worktree-init-v2-page~remote-conversation-page~new-thread-panel-page~o~bj5tp28r-Dcs9S3fj.js",
        descriptors[2].pattern,
      );
    },
  },
  {
    name: "custom endpoint picker enabled",
    run() {
      const source = 'function vbe({authMethod:e,availableModels:t,defaultModel:n,enabledReasoningEfforts:r,includeUltraReasoningEffort:i,models:a,useHiddenModels:o}){let s=[],c=null,l=o&&e!==`amazonBedrock`,u=a.some(e=>e.supportedReasoningEfforts.some(({reasoningEffort:e})=>e===`max`));return a.forEach(n=>{if(l?t.has(n.model):!n.hidden){s.push(n)}}),{models:s,defaultModel:c}}';
      const patched = applyModelPickerAllowlistPatch(source);
      assert.match(patched, /l=!1,u=/);
      assert.doesNotMatch(patched, /amazonBedrock/);
    },
  },
  {
    name: "bundle randomUUID module var preserved",
    run() {
      const source = 'var nB=class{async listModels(e){await this.ensureReady();let t=`model/list:${(0,c.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}}';
      const patched = applyMainBundleCatalogModelsPatch(source);
      assert.match(patched, /\(0,c\.randomUUID\)/);
      assert.doesNotMatch(patched, /\(0,o\.randomUUID\)/);
      new vm.Script(patched);
    },
  },
  {
    name: "minified identifier collisions avoided",
    run() {
      const source = 'var nB=class{async listModels(e){await this.ensureReady();let n=`model/list:${(0,o.randomUUID)()}`,r=await this.sendInternalRequest({id:n,method:`model/list`,params:e});if(r.error)throw Error(r.error.message??`Failed to read available models`);return r.result}}';
      const patched = applyMainBundleCatalogModelsPatch(source);
      new vm.Script(patched);
      assert.match(patched, /__cdlxResp/);
    },
  },
  {
    name: "helper injection survives renamed app-server class",
    run() {
      const source = '"use strict";var rW=class{async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);return n.result}}';
      const patched = applyMainBundleCatalogModelsPatch(source);
      assert.ok(patched.startsWith('"use strict";var __codexLinuxMergeCustomEndpointCatalogModelsV3=function('));
      new vm.Script(patched);
    },
  },
  {
    name: "stale v1 and v2 patched bundles upgrade to v3",
    run() {
      const v1 = 'var __codexLinuxMergeCustomEndpointCatalogModels=function(e,t){return e},nB=class{async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e});if(n.error)throw Error(n.error.message??`Failed to read available models`);let r=n.result;try{r=__codexLinuxMergeCustomEndpointCatalogModels(r,await this.getUserSavedConfiguration?.())}catch{}return r}}';
      const v2 = 'var __codexLinuxMergeCustomEndpointCatalogModels=function(e,t){return e},nB=class{async listModels(e){await this.ensureReady();let t=`model/list:${(0,o.randomUUID)()}`,n=await this.sendInternalRequest({id:t,method:`model/list`,params:e}),r;try{r=await this.getUserSavedConfiguration?.()}catch{}if(n.error){let e=__codexLinuxMergeCustomEndpointCatalogModels({data:[]},r);if(e.data?.length)return e;throw Error(n.error.message??`Failed to read available models`)}let i=n.result;try{i=__codexLinuxMergeCustomEndpointCatalogModels(i,r)}catch{}return i}}';
      for (const source of [v1, v2]) {
        const patched = applyMainBundleCatalogModelsPatch(source);
        assert.match(patched, /__cdlxCfg/);
        assert.match(patched, /__codexLinuxMergeCustomEndpointCatalogModelsV3/);
        new vm.Script(patched);
        assert.equal(applyMainBundleCatalogModelsPatch(patched), patched);
      }
    },
  },
  {
    name: "sidebar provider filter broadened for old direct loader",
    run() {
      const source = 'listRecentThreads({cursor:e,limit:t}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:null,archived:!1,sourceKinds:s})}';
      const patched = applySidebarProviderFilterPatch(source);
      assert.match(patched, /modelProviders:\[\]/);
      assert.doesNotMatch(patched, /modelProviders:null/);
    },
  },
  {
    name: "state-db-only preserved for old direct loader",
    run() {
      const source = 'listRecentThreads({cursor:e,limit:t,useStateDbOnly:n=!0}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:null,archived:!1,sourceKinds:s,useStateDbOnly:n})}';
      const patched = applySidebarProviderFilterPatch(source);
      assert.match(patched, /listRecentThreads\(\{cursor:e,limit:t,useStateDbOnly:n=!0\}\)/);
      assert.match(patched, /sourceKinds:s,useStateDbOnly:n/);
      assert.match(patched, /modelProviders:\[\]/);
    },
  },
  {
    name: "current async loader uses server defaults and filters blank titles",
    run() {
      const source = 'async runRecentConversationRefresh(){let s=await this.listRecentThreads({limit:a,cursor:null,useStateDbOnly:i});let c=s.data;if(i){}}async listRecentThreads({cursor:e,limit:t,useStateDbOnly:n=!1}){let r={limit:t,cursor:e,sortKey:this.params.requestClient.getCompatibleThreadSortKey(this.recentConversationSortKey),modelProviders:null,archived:!1,sourceKinds:oh,useStateDbOnly:n};return this.params.requestClient.sendRequest(`thread/list`,r)}';
      const patched = applySidebarProviderFilterPatch(source);
      assert.match(patched, /sourceKinds:\[\]/);
      // modelProviders [] restores all-provider history.
      assert.match(patched, /modelProviders:\[\]/);
    },
  },
  {
    name: "drift fails visibly",
    run() {
      const source = 'listRecentThreads({cursor:e,limit:t}){return this.params.requestClient.sendRequest(`thread/list`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:null,archived:!1,sourceKinds:s,extra:1})}';
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(" "));
      try {
        assert.equal(applySidebarProviderFilterPatch(source), source);
      } finally {
        console.warn = originalWarn;
      }
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /sidebar provider filter/);
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

console.log(`${scenarios.length}/${scenarios.length} custom-endpoint-model-picker eval scenarios passed`);
