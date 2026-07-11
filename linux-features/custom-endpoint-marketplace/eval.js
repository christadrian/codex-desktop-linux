#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyMarketplaceHidePatch } = require("./patch.js");

const scenarios = [
  {
    name: "marketplace hide guard disabled for custom endpoints",
    run() {
      const source =
        'function we(e,t,s){let c=(0,me.c)(53),l;c[0]===e?l=c[1]:(l={hostId:e},c[0]=e,c[1]=l);let u=ue(l)&&(s?.enabled??!0),d=s?.additionalMarketplaceKinds??_e,f=s?.installSuggestionPluginNames??null,p=re(`4218407052`),m=pe(ae(e)?.authMethod??null),h=ve;m?h=xe:p&&(h=be);let g=Ae({additionalMarketplaceKinds:d,includeRemoteCatalog:s?.includeRemoteCatalog??!0,includeVerticalCatalog:!p}),_=ie()';
      const patched = applyMarketplaceHidePatch(source);
      // After patch: h always stays ve (empty, hide nothing)
      assert.match(patched, /h=ve;0;let g=Ae\(/);
      // Old hide logic removed
      assert.doesNotMatch(patched, /m\?h=xe:p&&\(h=be\)/);
      // p and m still present (for includeVerticalCatalog and other uses)
      assert.match(patched, /4218407052/);
      assert.match(patched, /authMethod/);
    },
  },
  {
    name: "latest memoized auth guard is forced visible",
    run() {
      const source =
        'let c=Gy(`4218407052`),l=min(e)?.authMethod??null,u;r[2]===l?u=r[3]:(u=Nmn(l),r[2]=l,r[3]=u);let d=u,f=n?.includeRemoteCatalog??!0';
      assert.match(applyMarketplaceHidePatch(source), /let d=!1,f=/);
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
