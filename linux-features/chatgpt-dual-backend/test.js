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
  applyCloudAccessPatch,
  applySitesPluginAvailabilityPatch,
  chatGptSession,
  descriptors,
} = feature;

const fixture =
  "var Ver,VZ;Ver=Da(G,({get:e})=>({enabled:e(Uy,`637432221`),queryKey:[`appgen`,`access`],queryFn:()=>tb.safeGet(`/wham/sites/access`)})),VZ=Ca(G,({get:e})=>{if(!e(Uy,`637432221`))return`unavailable`;let{data:t,isError:n}=e(Ver);return n||t?.enabled===!1?`unavailable`:t?.enabled===!0?`available`:`loading`});function F8e({accountId:e,accountLoading:t,additionalRolloutEnabled:n,authLoading:r,authMethod:i,authenticatedAccountId:a,plan:o,rolloutEnabled:s,supportedSurface:c}){return c?!s&&!n?{status:`denied`,reason:`rollout-disabled`}:r&&i==null?{status:`loading`}:i===`chatgpt`?t&&(e==null||o==null)?{status:`loading`}:a==null||e==null?{status:`denied`,reason:`missing-account`}:a===e?R8e(o)?{status:`allowed`,accountId:e,plan:o}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}";
const navigationFixture =
  "function LJe(){let e=(0,RJe.c)(23),t=xu(Z),n=X(Zte),r=X(Hle),i=X(qS),a=Ld(ov,`quickChat`),o=!r&&i===`hidden`;return o?null:(0,IL.jsx)(G,{id:`sidebarElectron.quickChatNavLink`,defaultMessage:`Chat`})}";
const cloudFixture =
  "function vr(){let{access:P}=Sn();return P}function va(e){let{access:I}=Fn(),De=hr({cloudAccess:I,hasGitRepository:H,isBrowser:!1});return(0,Q.jsx)(Ji,{codexCloudAccess:I})}";
const sitesPluginFixture =
  "const n={js:e=>e,Os:`sites`},bs=[{autoInstallOptOutKey:n.js(n.Os),installWhenMissing:!0,name:n.Os,isAvailable:({features:e})=>e.sites}];globalThis.__sites=bs[0].isAvailable;";

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
      appServerClient: { getCachedAuthToken: () => "custom-token", getAuthToken: async () => "custom-token" },
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
    assert.match(patched, /globalThis\.__codexLinuxChatGptBackendSession="acct_1"/);
    assert.match(patched, /authMethod:i/);
    assert.match(patched, /status:`allowed`,accountId:globalThis\.__codexLinuxChatGptBackendSession,plan:null/);
    assert.match(patched, /__codexLinuxChatGptSitesAvailable/);
    assert.match(patched, /if\(typeof globalThis\.__codexLinuxChatGptBackendSession===`string`\)return`available`/);
    assert.doesNotThrow(() => new Function(patched));
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

test("enables Send to cloud with the saved ChatGPT session", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applyCloudAccessPatch(cloudFixture);
    assert.equal((patched.match(/__codexLinuxChatGptCloudAccess/g) ?? []).length, 2);
    assert.match(patched, /codexCloudAccess:I/);
    assert.equal(applyCloudAccessPatch(patched), patched);
  });
});

test("keeps the Sites bundled plugin eligible with saved ChatGPT auth", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applySitesPluginAvailabilityPatch(sitesPluginFixture);
    assert.match(patched, /__codexLinuxChatGptSitesPluginAvailable/);
    assert.equal(applySitesPluginAvailabilityPatch(patched), patched);
    new Function(patched)();
    assert.equal(globalThis.__sites({ features: { sites: false }, platform: "linux" }), true);
    assert.equal(globalThis.__sites({ features: { sites: false }, platform: "darwin" }), false);
    delete globalThis.__sites;
  });
});

test("does not enable Send to cloud without a saved ChatGPT session", () => {
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(applyCloudAccessPatch(cloudFixture), cloudFixture);
  });
});

test("routes Chat and Sites patches to their current upstream assets", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const applyForAsset = (assetName, source) => descriptors
      .filter((descriptor) => descriptor.phase === "webview-asset" && descriptor.pattern?.test(assetName))
      .sort((left, right) => left.order - right.order)
      .reduce((current, descriptor) => descriptor.apply(current), source);
    const chat = applyForAsset("app-initial~app-main~page-CQfFDtNf.js", navigationFixture);
    const cloud = applyForAsset("local-remote-dropdown-C3bvVXka.js", cloudFixture);
    const sites = applyForAsset(
      "app-initial~app-main~pull-request-code-review~onboarding-page~hotkey-window-thread-page~cha~b76hmflu-y0KJWbm3.js",
      fixture,
    );

    assert.match(chat, /__codexLinuxChatGptNavVisible/);
    assert.match(cloud, /__codexLinuxChatGptCloudAccess/);
    assert.match(sites, /globalThis\.__codexLinuxChatGptBackendSession="acct_1"/);
  });
});

test("shares Sites auth across split Vite chunks", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const entitlementChunk = applyChatGptDualBackendPatch(
      fixture.replace(/var Ver,VZ;.*?function F8e/s, "function F8e"),
    );
    const availabilityChunk = applyChatGptDualBackendPatch(
      fixture.slice(0, fixture.indexOf("function F8e")),
    );
    assert.match(entitlementChunk, /globalThis\.__codexLinuxChatGptBackendSession="acct_1"/);
    assert.match(availabilityChunk, /typeof globalThis\.__codexLinuxChatGptBackendSession/);
    assert.doesNotMatch(availabilityChunk, /typeof __codexLinuxChatGptBackendSession/);
  });
});
