#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { applyMarketplaceHidePatch } = require("./patch.js");
const {
  enabledLinuxFeatureIds,
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");

const fixture =
  'function we(e,t,s){let c=(0,me.c)(53),l;c[0]===e?l=c[1]:(l={hostId:e},c[0]=e,c[1]=l);let u=ue(l)&&(s?.enabled??!0),d=s?.additionalMarketplaceKinds??_e,f=s?.installSuggestionPluginNames??null,p=re(`4218407052`),m=pe(ae(e)?.authMethod??null),h=ve;m?h=xe:p&&(h=be);let g=Ae({additionalMarketplaceKinds:d,includeRemoteCatalog:s?.includeRemoteCatalog??!0,includeVerticalCatalog:!p}),_=ie()';

const patched =
  'function we(e,t,s){let c=(0,me.c)(53),l;c[0]===e?l=c[1]:(l={hostId:e},c[0]=e,c[1]=l);let u=ue(l)&&(s?.enabled??!0),d=s?.additionalMarketplaceKinds??_e,f=s?.installSuggestionPluginNames??null,p=re(`4218407052`),m=pe(ae(e)?.authMethod??null),h=ve;0;let g=Ae({additionalMarketplaceKinds:d,includeRemoteCatalog:s?.includeRemoteCatalog??!0,includeVerticalCatalog:!p}),_=ie()';

const currentFixture =
  'function xDt(e,t,n){let r=(0,D2.c)(54),i;r[0]===e?i=r[1]:(i={hostId:e},r[0]=e,r[1]=i);let a=p2(i)&&(n?.enabled??!0),o=n?.additionalMarketplaceKinds??M2,s=n?.installSuggestionPluginNames??null,c=Sj(`4218407052`),l=dEt(Cbt(e)?.authMethod??null),u=ZDt;l?u=$Dt:c&&(u=QDt);let d=kDt({additionalMarketplaceKinds:o,includeRemoteCatalog:n?.includeRemoteCatalog??!0,includeVerticalCatalog:!c})}';

const currentPatched =
  'function xDt(e,t,n){let r=(0,D2.c)(54),i;r[0]===e?i=r[1]:(i={hostId:e},r[0]=e,r[1]=i);let a=p2(i)&&(n?.enabled??!0),o=n?.additionalMarketplaceKinds??M2,s=n?.installSuggestionPluginNames??null,c=Sj(`4218407052`),l=dEt(Cbt(e)?.authMethod??null),u=ZDt;0;let d=kDt({additionalMarketplaceKinds:o,includeRemoteCatalog:n?.includeRemoteCatalog??!0,includeVerticalCatalog:!c})}';
const latestFixture =
  'function VR(e,t,n){let c=Gy(`4218407052`),l=min(e)?.authMethod??null,u;r[2]===l?u=r[3]:(u=Nmn(l),r[2]=l,r[3]=u);let d=u,f=n?.includeRemoteCatalog??!0,p=!c,m}';
const latestPatched =
  'function VR(e,t,n){let c=Gy(`4218407052`),l=min(e)?.authMethod??null,u;r[2]===l?u=r[3]:(u=Nmn(l),r[2]=l,r[3]=u);let d=!1,f=n?.includeRemoteCatalog??!0,p=!c,m}';

function applyPatchTwice(patchFn, source) {
  const applied = patchFn(source);
  assert.equal(patchFn(applied), applied);
  return applied;
}

test("marketplace hide guard patch applies and is idempotent", () => {
  const result = applyPatchTwice(applyMarketplaceHidePatch, fixture);
  assert.equal(result, patched);
});

test("marketplace hide guard patch applies to current plugin detail bundle shape", () => {
  const result = applyPatchTwice(applyMarketplaceHidePatch, currentFixture);
  assert.equal(result, currentPatched);
});

test("marketplace hide guard patch applies to latest memoized auth shape", () => {
  assert.equal(applyPatchTwice(applyMarketplaceHidePatch, latestFixture), latestPatched);
});

test("patch no-ops silently on unrelated source", () => {
  const unrelated = "console.log('hello')";
  const result = applyMarketplaceHidePatch(unrelated);
  assert.equal(result, unrelated);
});

test("routes the current shared plugins hook chunk", () => {
  const descriptor = require("./patch.js").descriptors[0];
  assert.match(
    "app-initial~app-main~onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~gwqc41kz-Bj9ubaFn.js",
    descriptor.pattern,
  );
  assert.equal(descriptor.apply(latestFixture), latestPatched);
});

test("patch ignores related bundles without the hide guard", () => {
  const warnings = [];
  const orig = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    const mismatched = 're(`4218407052`),pe(authMethod),something=else';
    const result = applyMarketplaceHidePatch(mismatched);
    assert.equal(result, mismatched);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = orig;
  }
});

function withTempFeatureConfig(enabled, fn) {
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  const root = path.resolve(__dirname, "..");
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "codex-custom-endpoint-marketplace-"),
  );
  process.env.CODEX_LINUX_FEATURES_CONFIG = path.join(tempDir, "features.json");
  try {
    fs.writeFileSync(
      process.env.CODEX_LINUX_FEATURES_CONFIG,
      JSON.stringify({ enabled }, null, 2),
    );
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

test("feature stays disabled until listed in features.json", () => {
  withTempFeatureConfig([], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), []);
    assert.deepEqual(
      loadLinuxFeaturePatchDescriptors({ featuresRoot: root }),
      [],
    );
  });
});

test("feature exposes one webview-asset descriptor when enabled", () => {
  withTempFeatureConfig(
    ["custom-endpoint-model-picker", "custom-endpoint-marketplace"],
    (root) => {
      const descriptors = loadLinuxFeaturePatchDescriptors({
        featuresRoot: root,
      });
      // Should include both features' descriptors
      const marketplaceDescs = descriptors.filter((d) =>
        d.id.includes("custom-endpoint-marketplace"),
      );
      assert.equal(marketplaceDescs.length, 1);
      assert.equal(marketplaceDescs[0].phase, "webview-asset");
      assert.equal(
        marketplaceDescs[0].apply(currentFixture),
        currentPatched,
      );
    },
  );
});
