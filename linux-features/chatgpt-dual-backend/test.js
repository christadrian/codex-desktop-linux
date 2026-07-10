"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const feature = require("./patch.js");
const {
  applyChatGptDualBackendPatch,
  applyChatNavigationPatch,
  chatGptSession,
  descriptors,
} = feature;

const fixture =
  "function F8e({accountId:e,accountLoading:t,additionalRolloutEnabled:n,authLoading:r,authMethod:i,authenticatedAccountId:a,plan:o,rolloutEnabled:s,supportedSurface:c}){return c?!s&&!n?{status:`denied`,reason:`rollout-disabled`}:r&&i==null?{status:`loading`}:i===`chatgpt`?t&&(e==null||o==null)?{status:`loading`}:a==null||e==null?{status:`denied`,reason:`missing-account`}:a===e?R8e(o)?{status:`allowed`,accountId:e,plan:o}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}/* /wham/sites/access */";
const navigationFixture =
  "function LJe(){let e=(0,RJe.c)(23),t=xu(Z),n=X(Zte),r=X(Hle),i=X(qS),a=Ld(ov,`quickChat`),o=!r&&i===`hidden`;return o?null:(0,IL.jsx)(G,{id:`sidebarElectron.quickChatNavLink`,defaultMessage:`Chat`})}";

test("exports the ChatGPT desktop auth bridge patch", () => {
  assert.equal(typeof feature.applyChatGptAuthBridgePatch, "function");
});

test("falls back to the saved ChatGPT token when custom endpoint auth has none", async () => {
  const source = '"use strict";const fs=require("node:fs"),os=require("node:os"),path=require("node:path");var JF=class extends Error{constructor(e,t,n){super(e),this.status=t,this.cause=n}};async function XF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i}){if(!i.attachAuth)return i;if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new JF(n,t,e)}}globalThis.__bridge=XF;';

  await withAuth({ tokens: { account_id: "acct_1", access_token: "chatgpt-token" } }, async () => {
    const patched = feature.applyChatGptAuthBridgePatch(source);
    assert.match(patched, /__codexLinuxChatGptSavedAuthToken/);
    assert.match(patched, /auth\.json/);
    assert.doesNotMatch(patched, /chatgpt-token/);
    assert.doesNotThrow(() => new Function("require", patched));
    new Function("require", patched)(require);

    const missing = await globalThis.__bridge({
      appServerClient: { getCachedAuthToken: () => null, getAuthToken: async () => null },
      errorStatus: 432,
      failureMessage: "missing",
      refreshToken: false,
      state: { attachAuth: true, tokenSource: "pending", token: null },
    });
    assert.equal(missing.token, "chatgpt-token");
    assert.equal(missing.tokenSource, "saved-chatgpt");

    const rejected = await globalThis.__bridge({
      appServerClient: { getCachedAuthToken: () => undefined, getAuthToken: async () => { throw new Error("custom auth"); } },
      errorStatus: 432,
      failureMessage: "missing",
      refreshToken: false,
      state: { attachAuth: true, tokenSource: "pending", token: null },
    });
    assert.equal(rejected.token, "chatgpt-token");
    delete globalThis.__bridge;
  });
});

function withAuth(auth, fn) {
  const oldHome = process.env.CODEX_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-chatgpt-dual-backend-"));
  process.env.CODEX_HOME = home;
  const cleanup = () => {
    oldHome == null ? delete process.env.CODEX_HOME : process.env.CODEX_HOME = oldHome;
    fs.rmSync(home, { recursive: true, force: true });
  };
  try {
    fs.writeFileSync(path.join(home, "auth.json"), JSON.stringify(auth));
    const result = fn();
    if (result != null && typeof result.then === "function") {
      return result.finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

test("uses the saved ChatGPT account only with an access token", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    assert.deepEqual(chatGptSession(), { accountId: "acct_1" });
  });
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(chatGptSession(), null);
  });
});

test("unlocks ChatGPT Chat and Sites without rerouting custom Codex traffic", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applyChatGptDualBackendPatch(fixture);
    assert.match(patched, /__codexLinuxChatGptBackendSession="acct_1"/);
    assert.match(patched, /authMethod:i/);
    assert.match(patched, /status:`allowed`,accountId:__codexLinuxChatGptBackendSession,plan:null/);
    assert.equal(applyChatGptDualBackendPatch(patched), patched);
  });
});

test("does not fake-enable ChatGPT surfaces without a saved session", () => {
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(applyChatGptDualBackendPatch(fixture), fixture);
  });
});

test("shows Chat navigation only with a saved ChatGPT session", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applyChatNavigationPatch(navigationFixture);
    assert.match(patched, /__codexLinuxChatGptNavVisible/);
    assert.doesNotMatch(patched, /i===`hidden`/);
  });
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(applyChatNavigationPatch(navigationFixture), navigationFixture);
  });
});

test("routes Chat and Sites patches to their current upstream assets", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const applyForAsset = (assetName, source) => descriptors
      .filter((descriptor) => descriptor.phase === "webview-asset" && descriptor.pattern?.test(assetName))
      .sort((left, right) => left.order - right.order)
      .reduce((current, descriptor) => descriptor.apply(current), source);
    const chat = applyForAsset("app-initial~app-main~page-CQfFDtNf.js", navigationFixture);
    const sites = applyForAsset(
      "app-initial~app-main~pull-request-code-review~onboarding-page~hotkey-window-thread-page~cha~b76hmflu-y0KJWbm3.js",
      fixture,
    );

    assert.match(chat, /__codexLinuxChatGptNavVisible/);
    assert.match(sites, /__codexLinuxChatGptBackendSession="acct_1"/);
  });
});
