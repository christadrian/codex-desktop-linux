"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const feature = require("./patch.js");
const {
  applyChatGptAuthBridgePatch,
  applyChatGptDualBackendPatch,
  applyChatGptEntitlementPatch,
  applyChatGptRequestRoutingPatch,
  applyCloudAccessPatch,
  applySitesAvailabilityPatch,
  applySitesPluginAvailabilityPatch,
  applyProductModeSwitchPatch,
  chatGptSession,
  descriptors,
} = feature;

const entitlementFixture =
  'function a_a({accountId:e,accountLoading:t,authLoading:n,authMethod:r,authenticatedAccountId:i,plan:a,supportedSurface:o}){return o?n&&r==null?{status:`loading`}:r===`chatgpt`?t&&(e==null||a==null)?{status:`loading`}:i==null||e==null?{status:`denied`,reason:`missing-account`}:i===e?c_a(a)?{status:`allowed`,accountId:e,plan:a}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}';
const availabilityFixture =
  'var Ver,VZ;Ver=Da(G,({get:e})=>({enabled:e(Uy,`637432221`),queryKey:[`appgen`,`access`],queryFn:()=>tb.safeGet(`/wham/sites/access`)})),VZ=Ca(G,({get:e})=>{if(!e(Uy,`637432221`))return`unavailable`;let{data:t,isError:n}=e(Ver);return n||t?.enabled===!1?`unavailable`:t?.enabled===!0?`available`:`loading`});';
const entitlementAsset = "app-initial-C-fROkKo.js";
const availabilityAsset = entitlementAsset;
const cloudFixture =
  "function vr(){let{access:P}=Sn();return P}function va(e){let{access:I}=Fn(),De=hr({cloudAccess:I,hasGitRepository:H,isBrowser:!1});return(0,Q.jsx)(Ji,{codexCloudAccess:I})}";
const requestRoutingFixture =
  "var Xi;Xi=class extends Ae{constructor(){super({getAdditionalHeaders:Ei})}async listConversations(){return this.safeGet(`/conversations`)}async getModelsResponse(){return this.safeGet(`/models`)}};globalThis.__chatClient=new Xi;globalThis.__customClient=new Ae;";
const sitesPluginFixture =
  "var Xo=[{autoInstallOptOutKey:n.bc(n._c),installWhenMissing:!0,name:n._c,syncToRemoteSshHosts:!0,isAvailable:({features:e})=>e.sites},{autoInstallOptOutKey:n.bc(n.lc),installWhenMissing:!0,name:n.lc,isAvailable:({features:e})=>e.inAppBrowserUseAllowed}];class Marketplace{constructor(){this.name=`BundledPluginsMarketplace`}}";
const productModeSwitchFixture =
  "function mln(e,t){let n=t;return{local:n,workMode:e.authMethod!==`chatgpt`&&e.authMethod!==`apikey`&&e.authMethod!==`personalAccessToken`&&n.status===`allowed`?{status:`denied`,reason:`unsupported-auth`}:n}}";

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
    if (result != null && typeof result.then === "function") return result.finally(cleanup);
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function applyForAsset(assetName, source) {
  return descriptors
    .filter((descriptor) => descriptor.phase === "webview-asset" && descriptor.pattern?.test(assetName))
    .sort((left, right) => left.order - right.order)
    .reduce((current, descriptor) => descriptor.apply(current), source);
}

test("uses the saved ChatGPT account only with an access token", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    assert.deepEqual(chatGptSession(), { accountId: "acct_1" });
  });
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(chatGptSession(), null);
  });
});

test("patches the current Chat entitlement for custom endpoints", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applyChatGptEntitlementPatch(entitlementFixture);
    assert.match(patched, /globalThis\.__codexLinuxChatGptBackendSession="acct_1"/);
    assert.match(patched, /r!==`chatgpt`\?\{status:`allowed`/);
    assert.equal(applyChatGptEntitlementPatch(patched), patched);
    assert.doesNotThrow(() => new Function("ot", patched));

    const entitlement = new Function("c_a", `${patched};return a_a`)(() => true);
    assert.deepEqual(
      entitlement({
        accountId: null,
        accountLoading: false,
        authLoading: false,
        authMethod: "apikey",
        authenticatedAccountId: null,
        plan: null,
        supportedSurface: true,
      }),
      { status: "allowed", accountId: "acct_1", plan: null },
    );
    assert.deepEqual(
      entitlement({
        accountId: "acct_1",
        accountLoading: false,
        authLoading: false,
        authMethod: "chatgpt",
        authenticatedAccountId: "acct_1",
        plan: "plus",
        supportedSurface: true,
      }),
      { status: "allowed", accountId: "acct_1", plan: "plus" },
    );
    assert.deepEqual(
      entitlement({
        accountId: null,
        accountLoading: false,
        authLoading: false,
        authMethod: "apikey",
        authenticatedAccountId: null,
        plan: null,
        supportedSurface: false,
      }),
      { status: "allowed", accountId: "acct_1", plan: null },
    );
  });
});

test("patches current Sites availability independently", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applySitesAvailabilityPatch(availabilityFixture);
    assert.match(patched, /__codexLinuxChatGptSitesAvailable/);
    assert.match(patched, /if\(!0\)return`available`/);
    assert.equal(applySitesAvailabilityPatch(patched), patched);
    assert.doesNotThrow(() => new Function(patched));
  });
});

test("combined helper patches split current chunks without execution-order coupling", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const entitlement = applyChatGptDualBackendPatch(entitlementFixture);
    const availability = applyChatGptDualBackendPatch(availabilityFixture);
    assert.match(entitlement, /__codexLinuxChatGptBackendSession/);
    assert.doesNotMatch(entitlement, /__codexLinuxChatGptSitesAvailable/);
    assert.match(availability, /__codexLinuxChatGptSitesAvailable/);
    assert.doesNotMatch(availability, /__codexLinuxChatGptBackendSession/);
  });
});

test("does not fake-enable ChatGPT surfaces without a saved session", () => {
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(applyChatGptEntitlementPatch(entitlementFixture), entitlementFixture);
    assert.equal(applySitesAvailabilityPatch(availabilityFixture), availabilityFixture);
  });
});

test("routes Chat entitlement and Sites availability to exact current assets", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    assert.match(applyForAsset(entitlementAsset, entitlementFixture), /__codexLinuxChatGptBackendSession/);
    assert.match(applyForAsset(entitlementAsset, requestRoutingFixture), /__codexLinuxChatGptOfficialBackend/);
    assert.match(applyForAsset(availabilityAsset, availabilityFixture), /__codexLinuxChatGptSitesAvailable/);
    assert.equal(
      applyForAsset("app-initial~app-main~unrelated-old-shape.js", entitlementFixture),
      entitlementFixture,
    );
    assert.deepEqual(
      descriptors.filter((descriptor) =>
        descriptor.id === "chatgpt-request-routing" ||
        descriptor.id.includes("entitlement") ||
        descriptor.id === "sites-availability")
        .map((descriptor) => descriptor.id),
      ["chatgpt-request-routing", "chatgpt-chat-entitlement", "sites-availability"],
    );
  });
});

test("warns instead of claiming success when the current entitlement drifts", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      const drifted = entitlementFixture.replace("supportedSurface:o", "supportedSurface:o,extra:s");
      assert.equal(applyChatGptEntitlementPatch(drifted), drifted);
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /current ChatGPT entitlement guard/);
  });
});

test("enables Send to cloud with saved ChatGPT auth", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const cloud = applyCloudAccessPatch(cloudFixture);
    assert.equal((cloud.match(/__codexLinuxChatGptCloudAccess/g) ?? []).length, 2);
    assert.equal(applyCloudAccessPatch(cloud), cloud);

  });
});

test("falls back to the saved ChatGPT token before custom endpoint auth", async () => {
  const source = '"use strict";const fs=require("node:fs"),os=require("node:os"),path=require("node:path");var JF=class extends Error{constructor(e,t,n){super(e),this.status=t,this.cause=n}};async function XF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i}){if(!i.attachAuth)return i;if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new JF(n,t,e)}}globalThis.__bridge=XF;';

  await withAuth({ tokens: { account_id: "acct_1", access_token: "chatgpt-token" } }, async () => {
    const patched = applyChatGptAuthBridgePatch(source);
    assert.match(patched, /__codexLinuxChatGptSavedAuthToken/);
    assert.doesNotMatch(patched, /chatgpt-token/);
    new Function("require", patched)(require);
    const result = await globalThis.__bridge({
      appServerClient: { getCachedAuthToken: () => "custom-token", getAuthToken: async () => "custom-token" },
      errorStatus: 432,
      failureMessage: "missing",
      refreshToken: false,
      state: { attachAuth: true, tokenSource: "pending", token: null },
    });
    assert.equal(result.token, "chatgpt-token");
    assert.equal(result.tokenSource, "saved-chatgpt");
    delete globalThis.__bridge;
  });
});

test("reads saved ChatGPT auth without depending on minified module aliases", async () => {
  const source = '"use strict";function unrelated(){let r=require("node:fs");return r.existsSync(".")}var JF=class extends Error{constructor(e,t,n){super(e),this.status=t,this.cause=n}};async function XF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i}){if(!i.attachAuth)return i;if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new JF(n,t,e)}}globalThis.__bridge=XF;';

  await withAuth({ tokens: { account_id: "acct_1", access_token: "chatgpt-token" } }, async () => {
    const patched = applyChatGptAuthBridgePatch(source);
    new Function("require", patched)(require);
    const result = await globalThis.__bridge({
      appServerClient: { getCachedAuthToken: () => undefined, getAuthToken: async () => undefined },
      errorStatus: 432,
      failureMessage: "missing",
      refreshToken: false,
      state: { attachAuth: true, tokenSource: "pending", token: null },
    });
    assert.equal(result.token, "chatgpt-token");
    assert.equal(result.tokenSource, "saved-chatgpt");
    delete globalThis.__bridge;
  });
});

test("routes only the dedicated ChatGPT client to the official backend", () => {
  const patched = applyChatGptRequestRoutingPatch(requestRoutingFixture);
  assert.match(patched, /__codexLinuxChatGptOfficialBackend/);
  assert.equal(applyChatGptRequestRoutingPatch(patched), patched);

  class ApiClient {
    getRequestTarget(endpoint) {
      return { headers: {}, url: endpoint };
    }
  }
  new Function("Ae", "Ei", patched)(ApiClient, () => ({}));
  assert.equal(
    globalThis.__chatClient.getRequestTarget("/models").url,
    "https://chatgpt.com/backend-api/models",
  );
  assert.equal(globalThis.__customClient.getRequestTarget("/models").url, "/models");
  delete globalThis.__chatClient;
  delete globalThis.__customClient;
});

test("keeps the current bundled ChatGPT plugin available with saved auth", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applySitesPluginAvailabilityPatch(sitesPluginFixture);
    assert.match(patched, /isAvailable:\(\)=>!0\/\*__codexLinuxChatGptSitesPluginAvailable\*\//);
    assert.equal(applySitesPluginAvailabilityPatch(patched), patched);
    assert.doesNotThrow(() => new Function("n", patched));
  });
});

test("does not retain the bundled ChatGPT plugin without saved auth", () => {
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(applySitesPluginAvailabilityPatch(sitesPluginFixture), sitesPluginFixture);
  });
});

test("registers bundled ChatGPT plugin retention before webview entitlement patches", () => {
  assert.deepEqual(
    descriptors
      .filter((descriptor) => descriptor.id === "sites-plugin-availability")
      .map(({ id, phase, order }) => ({ id, phase, order })),
    [{ id: "sites-plugin-availability", phase: "main-bundle", order: 20761 }],
  );
});

test("keeps the ChatGPT and Codex product switch enabled for custom endpoint auth", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applyProductModeSwitchPatch(productModeSwitchFixture);
    assert.match(patched, /__codexLinuxChatGptBackendSession==null/);
    assert.match(patched, /__codexLinuxChatGptProductModeSwitch/);
    assert.equal(applyProductModeSwitchPatch(patched), patched);
    const getAccess = new Function(`${patched};return mln`)();
    const allowed = { status: "allowed" };
    globalThis.__codexLinuxChatGptBackendSession = { accessToken: "saved" };
    try {
      const access = getAccess({ authMethod: "api-key" }, allowed);
      assert.equal(access.workMode, allowed);
      assert.equal(access.workMode.status === "denied" && access.workMode.reason === "unsupported-auth", false);
    } finally {
      delete globalThis.__codexLinuxChatGptBackendSession;
    }
  });
});

test("keeps custom auth work mode denied when the runtime auth bridge has no session", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    const patched = applyProductModeSwitchPatch(productModeSwitchFixture);
    const getAccess = new Function(`${patched};return mln`)();
    const access = getAccess({ authMethod: "api-key" }, { status: "allowed" });
    assert.deepEqual(access.workMode, { status: "denied", reason: "unsupported-auth" });
  });
});

test("does not expose the product switch without saved ChatGPT auth", () => {
  withAuth({ tokens: { account_id: "acct_1" } }, () => {
    assert.equal(applyProductModeSwitchPatch(productModeSwitchFixture), productModeSwitchFixture);
  });
});

test("routes the product switch patch to the current consolidated webview asset", () => {
  withAuth({ tokens: { account_id: "acct_1", access_token: "token" } }, () => {
    assert.match(applyForAsset(entitlementAsset, productModeSwitchFixture), /__codexLinuxChatGptProductModeSwitch/);
    assert.deepEqual(
      descriptors
        .filter((descriptor) => descriptor.id === "product-mode-switch")
        .map(({ id, phase, order }) => ({ id, phase, order })),
      [{ id: "product-mode-switch", phase: "webview-asset", order: 20771 }],
    );
  });
});

test("exports the current auth bridge and entitlement patch APIs", () => {
  assert.equal(typeof feature.applyChatGptAuthBridgePatch, "function");
  assert.equal(typeof feature.applyChatGptEntitlementPatch, "function");
  assert.equal(typeof feature.applyChatGptRequestRoutingPatch, "function");
  assert.equal(typeof feature.applySitesAvailabilityPatch, "function");
  assert.equal(typeof feature.applySitesPluginAvailabilityPatch, "function");
  assert.equal(typeof feature.applyProductModeSwitchPatch, "function");
});
