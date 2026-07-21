#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  applyChatGptAuthBridgePatch,
  applyChatGptEntitlementPatch,
  applyChatGptRequestRoutingPatch,
  applyCloudAccessPatch,
  applySitesAvailabilityPatch,
  applySitesPluginAvailabilityPatch,
  descriptors,
} = require("./patch.js");

const previousCodexHome = process.env.CODEX_HOME;
const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-chatgpt-dual-backend-eval-"));
process.env.CODEX_HOME = codexHome;
fs.writeFileSync(
  path.join(codexHome, "auth.json"),
  JSON.stringify({ tokens: { account_id: "acct_eval", access_token: "token" } }),
);
process.on("exit", () => {
  previousCodexHome == null
    ? delete process.env.CODEX_HOME
    : process.env.CODEX_HOME = previousCodexHome;
  fs.rmSync(codexHome, { recursive: true, force: true });
});

const entitlementSource =
  'function rt({accountId:e,accountLoading:t,authLoading:n,authMethod:r,authenticatedAccountId:i,plan:a,supportedSurface:o}){return o?n&&r==null?{status:`loading`}:r===`chatgpt`?t&&(e==null||a==null)?{status:`loading`}:i==null||e==null?{status:`denied`,reason:`missing-account`}:i===e?ot(a)?{status:`allowed`,accountId:e,plan:a}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}';
const availabilitySource =
  'var Ver,VZ;Ver=Da(G,({get:e})=>({enabled:e(Uy,`637432221`),queryKey:[`appgen`,`access`],queryFn:()=>tb.safeGet(`/wham/sites/access`)})),VZ=Ca(G,({get:e})=>{if(!e(Uy,`637432221`))return`unavailable`;let{data:t,isError:n}=e(Ver);return n||t?.enabled===!1?`unavailable`:t?.enabled===!0?`available`:`loading`});';

const entitlementPatched = applyChatGptEntitlementPatch(entitlementSource);
assert.match(entitlementPatched, /__codexLinuxChatGptBackendSession/);
assert.doesNotMatch(entitlementPatched, /additionalRolloutEnabled|rolloutEnabled/);
assert.equal(applyChatGptEntitlementPatch(entitlementPatched), entitlementPatched);
const entitlement = new Function("ot", `${entitlementPatched};return rt`)(() => true);
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
  { status: "allowed", accountId: "acct_eval", plan: null },
);
assert.deepEqual(
  entitlement({
    accountId: "acct_eval",
    accountLoading: false,
    authLoading: false,
    authMethod: "chatgpt",
    authenticatedAccountId: "acct_eval",
    plan: "plus",
    supportedSurface: true,
  }),
  { status: "allowed", accountId: "acct_eval", plan: "plus" },
);

const availabilityPatched = applySitesAvailabilityPatch(availabilitySource);
assert.match(availabilityPatched, /__codexLinuxChatGptSitesAvailable/);
assert.match(availabilityPatched, /if\(!0\)return`available`/);
assert.equal(applySitesAvailabilityPatch(availabilityPatched), availabilityPatched);

const applyForAsset = (assetName, source) => descriptors
  .filter((descriptor) => descriptor.phase === "webview-asset" && descriptor.pattern?.test(assetName))
  .sort((left, right) => left.order - right.order)
  .reduce((current, descriptor) => descriptor.apply(current), source);
assert.match(
  applyForAsset(
    "app-initial~artifact-tab-content.electron~app-main~pull-request-code-review~new-thread-pane~nmo0zeut-RFRJ7pMF.js",
    entitlementSource,
  ),
  /__codexLinuxChatGptBackendSession/,
);
assert.match(
  applyForAsset(
    "app-initial~artifact-tab-content.electron~notebook-preview-panel~app-main~pull-request-rout~k0tdw7da-wn-v3SJs.js",
    availabilitySource,
  ),
  /__codexLinuxChatGptSitesAvailable/,
);
assert.equal(
  applyForAsset("app-initial~app-main~legacy.js", entitlementSource),
  entitlementSource,
);

const requestRoutingSource =
  "var Xi;Xi=class extends Ae{constructor(){super({getAdditionalHeaders:Ei})}async listConversations(){return this.safeGet(`/conversations`)}async getModelsResponse(){return this.safeGet(`/models`)}};globalThis.__chatClient=new Xi;globalThis.__customClient=new Ae;";
const requestRoutingPatched = applyChatGptRequestRoutingPatch(requestRoutingSource);
assert.match(requestRoutingPatched, /__codexLinuxChatGptOfficialBackend/);
assert.equal(applyChatGptRequestRoutingPatch(requestRoutingPatched), requestRoutingPatched);
class EvalApiClient {
  getRequestTarget(endpoint) {
    return { headers: {}, url: endpoint };
  }
}
new Function("Ae", "Ei", requestRoutingPatched)(EvalApiClient, () => ({}));
assert.equal(
  globalThis.__chatClient.getRequestTarget("/conversations").url,
  "https://chatgpt.com/backend-api/conversations",
);
assert.equal(globalThis.__customClient.getRequestTarget("/conversations").url, "/conversations");
delete globalThis.__chatClient;
delete globalThis.__customClient;

const cloud =
  "function vr(){let{access:P}=Sn();return P}function va(e){let{access:I}=Fn(),De=hr({cloudAccess:I,hasGitRepository:H,isBrowser:!1});return(0,Q.jsx)(Ji,{codexCloudAccess:I})}";
assert.equal((applyCloudAccessPatch(cloud).match(/__codexLinuxChatGptCloudAccess/g) ?? []).length, 2);
const sitesPlugin =
  "const bs=[{autoInstallOptOutKey:n.js(n.Os),installWhenMissing:!0,name:n.Os,isAvailable:({features:e})=>e.sites}];";
assert.match(applySitesPluginAvailabilityPatch(sitesPlugin), /__codexLinuxChatGptSitesPluginAvailable/);

const main = applyChatGptAuthBridgePatch(
  '"use strict";function unrelated(){let r=require("node:fs");return r.existsSync(".")}var JF=class extends Error{};async function XF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i}){if(!i.attachAuth)return i;if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new JF(n,t,e)}}globalThis.__bridge=XF;',
);
assert.match(main, /__codexLinuxChatGptSavedAuthToken/);
assert.match(main, /tokenSource:`saved-chatgpt`/);
assert.ok(main.indexOf("__codexLinuxChatGptSavedAuthToken()") < main.indexOf("getCachedAuthToken"));
assert.match(main, /require\(`node:fs`\)/);
assert.doesNotThrow(() => new Function("require", main));

new Function("require", main)(require);
globalThis.__bridge({
  appServerClient: { getCachedAuthToken: () => undefined, getAuthToken: async () => undefined },
  errorStatus: 432,
  failureMessage: "missing",
  refreshToken: false,
  state: { attachAuth: true, tokenSource: "pending", token: null },
}).then((result) => {
  assert.equal(result.tokenSource, "saved-chatgpt");
  assert.equal(result.token, "token");
  delete globalThis.__bridge;
  console.log("16/16 current chatgpt-dual-backend eval scenarios passed");
});
