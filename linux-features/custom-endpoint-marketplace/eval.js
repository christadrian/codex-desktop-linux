#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyMarketplaceHidePatch } = require("./patch.js");

const scenarios = [
  {
    name: "current shared marketplace hook stays visible for custom endpoints",
    run() {
      const descriptor = require("./patch.js").descriptors[0];
      assert.match(
        "app-initial~artifact-tab-content.electron~notebook-preview-panel~app-main~pull-request-rout~d8yqlw7s-DLBl6kj-.js",
        descriptor.pattern,
      );
      const source =
        'function Vt(e,t,i){let a=(0,bn.c)(65),o;a[0]===e?o=a[1]:(o={hostId:e},a[0]=e,a[1]=o);let s=ue(o)&&(i?.enabled??!0),c=i?.additionalMarketplaceKinds??Tn,l=i?.installSuggestionPluginNames??null,u=ie(`4218407052`),d=ce(e)?.authMethod??null,f;a[2]===d?f=a[3]:(f=we(d),a[2]=d,a[3]=f);let p=f,m=i?.includeRemoteCatalog??!0,ee=!u,h}';
      const patched = applyMarketplaceHidePatch(source);
      assert.match(patched, /let p=!1,m=/);
      assert.doesNotMatch(patched, /let p=f,m=/);
      assert.equal(applyMarketplaceHidePatch(patched), patched);
    },
  },
];

let failures = 0;
for (const scenario of scenarios) {
  try {
    scenario.run();
    console.log(`PASS: ${scenario.name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL: ${scenario.name}`);
    console.error(`  ${err.message}`);
  }
}

process.exit(failures > 0 ? 1 : 0);
