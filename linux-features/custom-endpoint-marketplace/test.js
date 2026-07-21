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

const latestAsset =
  'app-initial~artifact-tab-content.electron~notebook-preview-panel~app-main~pull-request-rout~d8yqlw7s-DLBl6kj-.js';
const latestInstalledFixture =
  'function Vt(e,t,i){let a=(0,bn.c)(65),o;a[0]===e?o=a[1]:(o={hostId:e},a[0]=e,a[1]=o);let s=ue(o)&&(i?.enabled??!0),c=i?.additionalMarketplaceKinds??Tn,l=i?.installSuggestionPluginNames??null,u=ie(`4218407052`),d=ce(e)?.authMethod??null,f;a[2]===d?f=a[3]:(f=we(d),a[2]=d,a[3]=f);let p=f,m=i?.includeRemoteCatalog??!0,ee=!u,h}';

function applyPatchTwice(patchFn, source) {
  const applied = patchFn(source);
  assert.equal(patchFn(applied), applied);
  return applied;
}

test("routes and patches the latest shared marketplace hook", () => {
  const descriptor = require("./patch.js").descriptors[0];
  assert.match(latestAsset, descriptor.pattern);
  assert.doesNotMatch(
    "app-initial~app-main~onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~gwqc41kz-Bj9ubaFn.js",
    descriptor.pattern,
  );
  const patched = applyPatchTwice(applyMarketplaceHidePatch, latestInstalledFixture);
  assert.match(patched, /let p=!1,m=/);
  assert.doesNotMatch(patched, /let p=f,m=/);
});

test("patch no-ops silently on unrelated source", () => {
  const unrelated = "console.log('hello')";
  const result = applyMarketplaceHidePatch(unrelated);
  assert.equal(result, unrelated);
});

test("patch warns when the targeted hook drifts", () => {
  const warnings = [];
  const orig = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    const mismatched = 're(`4218407052`),pe(authMethod),something=else';
    const result = applyMarketplaceHidePatch(mismatched);
    assert.equal(result, mismatched);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /marketplace hide flag/);
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
      assert.match(marketplaceDescs[0].apply(latestInstalledFixture), /let p=!1,m=/);
    },
  );
});
