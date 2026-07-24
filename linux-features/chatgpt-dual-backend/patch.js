"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  findMatchingBrace,
} = require("../../scripts/patches/lib/minified-js.js");

const PATCH_MARKER = "__codexLinuxChatGptBackendSession";
const SITES_AVAILABILITY_MARKER = "__codexLinuxChatGptSitesAvailable";
const AUTH_BRIDGE_MARKER = "__codexLinuxChatGptSavedAuthToken";
const REQUEST_ROUTING_MARKER = "__codexLinuxChatGptOfficialBackend";
const CLOUD_ACCESS_MARKER = "__codexLinuxChatGptCloudAccess";
const SITES_PLUGIN_MARKER = "__codexLinuxChatGptSitesPluginAvailable";
const PRODUCT_MODE_SWITCH_MARKER = "__codexLinuxChatGptProductModeSwitch";
const CHAT_ENTITLEMENT_GUARD =
  /(function [A-Za-z_$][\w$]*\(\{accountId:[A-Za-z_$][\w$]*,accountLoading:[A-Za-z_$][\w$]*,authLoading:[A-Za-z_$][\w$]*,authMethod:([A-Za-z_$][\w$]*),authenticatedAccountId:[A-Za-z_$][\w$]*,plan:[A-Za-z_$][\w$]*,supportedSurface:[A-Za-z_$][\w$]*\}\)\{return )/;
const SITES_AVAILABILITY_GUARD =
  /([A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\([A-Za-z_$][\w$]*,\(\{get:([A-Za-z_$][\w$]*)\}\)=>\{)(if\(!\2\([A-Za-z_$][\w$]*,`637432221`\)\)return`unavailable`;)/;
const CHAT_ENTITLEMENT_ASSET_PATTERN =
  /^app-initial-[^.]+\.js$/;
const CHATGPT_REQUEST_CLIENT =
  /([A-Za-z_$][\w$]*=class extends [A-Za-z_$][\w$]*\{constructor\(\)\{super\(\{getAdditionalHeaders:[A-Za-z_$][\w$]*\}\)\})/;
const SITES_AVAILABILITY_ASSET_PATTERN =
  /^app-initial-[^.]+\.js$/;
const SITES_PLUGIN_AVAILABILITY =
  /(\{autoInstallOptOutKey:([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\(\2\.([A-Za-z_$][\w$]*)\),installWhenMissing:!0,name:\2\.\4,syncToRemoteSshHosts:!0,isAvailable:)\(\{features:([A-Za-z_$][\w$]*)\}\)=>\5\.sites/;
const PRODUCT_MODE_SWITCH_GUARD =
  /(workMode:)(([A-Za-z_$][\w$]*)\.authMethod!==`chatgpt`&&\3\.authMethod!==`apikey`&&\3\.authMethod!==`personalAccessToken`&&)([A-Za-z_$][\w$]*)\.status===`allowed`\?\{status:`denied`,reason:`unsupported-auth`\}:\4/;

function chatGptSession() {
  try {
    const authPath = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "auth.json");
    const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
    const accountId = auth?.tokens?.account_id;
    const accessToken = auth?.tokens?.access_token;
    return typeof accountId === "string" && accountId.length > 0 && typeof accessToken === "string" && accessToken.length > 0
      ? { accountId }
      : null;
  } catch {
    return null;
  }
}

function applyChatGptEntitlementPatch(source) {
  const session = chatGptSession();
  if (session == null) {
    if (source.includes("not-chatgpt-auth")) {
      console.warn("WARN: No ChatGPT session in ~/.codex/auth.json — skipping ChatGPT Chat entitlement patch");
    }
    return source;
  }
  if (source.includes(`globalThis.${PATCH_MARKER}=`)) {
    return source;
  }
  if (!CHAT_ENTITLEMENT_GUARD.test(source)) {
    if (source.includes("not-chatgpt-auth")) {
      console.warn("WARN: Could not find current ChatGPT entitlement guard — skipping ChatGPT Chat entitlement patch");
    }
    return source;
  }
  return source.replace(
    CHAT_ENTITLEMENT_GUARD,
    (_match, prefix, authMethod) =>
      `globalThis.${PATCH_MARKER}=${JSON.stringify(session.accountId)};${prefix}${authMethod}!==\`chatgpt\`?{status:\`allowed\`,accountId:globalThis.${PATCH_MARKER},plan:null}:`,
  );
}

function applySitesAvailabilityPatch(source) {
  if (chatGptSession() == null) {
    if (source.includes("/wham/sites/access")) {
      console.warn("WARN: No ChatGPT session in ~/.codex/auth.json — skipping ChatGPT Sites availability patch");
    }
    return source;
  }
  if (source.includes(SITES_AVAILABILITY_MARKER)) {
    return source;
  }
  if (!SITES_AVAILABILITY_GUARD.test(source)) {
    if (source.includes("/wham/sites/access")) {
      console.warn("WARN: Could not find current ChatGPT Sites availability guard — skipping ChatGPT Sites visibility patch");
    }
    return source;
  }
  return source.replace(
    SITES_AVAILABILITY_GUARD,
    `$1if(!0)return\`available\`;/*${SITES_AVAILABILITY_MARKER}*/$3`,
  );
}

function applyChatGptDualBackendPatch(source) {
  return applyProductModeSwitchPatch(
    applySitesAvailabilityPatch(
      applyChatGptEntitlementPatch(applyChatGptRequestRoutingPatch(source)),
    ),
  );
}

function applyChatGptRequestRoutingPatch(source) {
  if (source.includes(REQUEST_ROUTING_MARKER)) return source;
  if (!CHATGPT_REQUEST_CLIENT.test(source)) {
    if (source.includes("getModelsResponse") && source.includes("listConversations")) {
      console.warn("WARN: Could not find current ChatGPT request client — skipping official backend routing patch");
    }
    return source;
  }
  return source.replace(
    CHATGPT_REQUEST_CLIENT,
    `$1getRequestTarget(e,t){let n=super.getRequestTarget(e,t);return{...n,url:\`https://chatgpt.com/backend-api\${n.url}\`}}/*${REQUEST_ROUTING_MARKER}*/`,
  );
}

function applyCloudAccessPatch(source) {
  if (source.includes(CLOUD_ACCESS_MARKER)) return source;
  if (chatGptSession() == null) {
    if (source.includes("codexCloudAccess:")) {
      console.warn("WARN: No ChatGPT session in ~/.codex/auth.json — skipping Send to cloud patch");
    }
    return source;
  }
  const needle = /\{access:([A-Za-z_$][\w$]*)\}=([A-Za-z_$][\w$]*)\(\)/g;
  const patched = source.replace(
    needle,
    `{access:$1}={...$2(),access:\`enabled\`}/*${CLOUD_ACCESS_MARKER}*/`,
  );
  if (patched === source && source.includes("codexCloudAccess:")) {
    console.warn("WARN: Could not find Codex Cloud access hook — skipping Send to cloud patch");
  }
  return patched;
}

function applySitesPluginAvailabilityPatch(source) {
  if (source.includes(SITES_PLUGIN_MARKER)) return source;
  if (chatGptSession() == null) return source;
  const patched = source.replace(
    SITES_PLUGIN_AVAILABILITY,
    `$1()=>!0/*${SITES_PLUGIN_MARKER}*/`,
  );
  if (
    patched === source &&
    source.includes("BundledPluginsMarketplace") &&
    source.includes("installWhenMissing") &&
    source.includes(".sites")
  ) {
    console.warn("WARN: Could not find current bundled ChatGPT plugin availability descriptor — skipping ChatGPT plugin retention patch");
  }
  return patched;
}

function applyProductModeSwitchPatch(source) {
  if (source.includes(PRODUCT_MODE_SWITCH_MARKER)) return source;
  if (chatGptSession() == null) return source;
  if (
    !source.includes("unsupported-auth") ||
    !source.includes("workMode:")
  ) {
    return source;
  }
  const patched = source.replace(
    PRODUCT_MODE_SWITCH_GUARD,
    `$1globalThis.__codexLinuxChatGptBackendSession==null&&$2$4.status===\`allowed\`?{status:\`denied\`,reason:\`unsupported-auth\`}:$4/*${PRODUCT_MODE_SWITCH_MARKER}*/`,
  );
  if (patched === source) {
    console.warn("WARN: Could not find current custom-auth product mode guard — skipping ChatGPT/Codex switch patch");
  }
  return patched;
}

function applyChatGptAuthBridgePatch(source) {
  if (source.includes(AUTH_BRIDGE_MARKER)) return source;
  const headPattern = /async function ([A-Za-z_$][\w$]*)\(\{appServerClient:([A-Za-z_$][\w$]*),errorStatus:([A-Za-z_$][\w$]*),failureMessage:([A-Za-z_$][\w$]*),refreshToken:([A-Za-z_$][\w$]*),state:([A-Za-z_$][\w$]*)\}\)\{/;
  const head = source.match(headPattern);
  if (head == null) {
    if (source.includes("Failed to retrieve authentication token")) {
      console.warn("WARN: Could not find ChatGPT desktop auth bridge — skipping saved ChatGPT token fallback");
    }
    return source;
  }
  const openBrace = head.index + head[0].length - 1;
  const closeBrace = findMatchingBrace(source, openBrace);
  if (closeBrace === -1) return source;
  const original = source.slice(head.index, closeBrace + 1);
  const errorClass = original.match(/throw new ([A-Za-z_$][\w$]*)\(/)?.[1];
  if (errorClass == null) return source;

  const [, functionName, appServerClient, errorStatus, failureMessage, refreshToken, state] = head;
  const helper = `function ${AUTH_BRIDGE_MARKER}(){try{let e=require(\`node:fs\`),t=require(\`node:path\`),n=process.env.CODEX_HOME||t.join(process.env.HOME||require(\`node:os\`).homedir(),\`.codex\`),r=JSON.parse(e.readFileSync(t.join(n,\`auth.json\`),\`utf8\`))?.tokens?.access_token;return typeof r===\`string\`&&r.length>0?r:void 0}catch{return void 0}}`;
  const replacement = `async function ${functionName}({appServerClient:${appServerClient},errorStatus:${errorStatus},failureMessage:${failureMessage},refreshToken:${refreshToken},state:${state}}){if(!${state}.attachAuth)return ${state};let __cdlxSavedToken=${AUTH_BRIDGE_MARKER}();if(__cdlxSavedToken!==void 0)return{...${state},tokenSource:\`saved-chatgpt\`,token:__cdlxSavedToken};if(!${refreshToken}){let __cdlxCachedToken=${appServerClient}.getCachedAuthToken?.();if(typeof __cdlxCachedToken===\`string\`&&__cdlxCachedToken.length>0)return{...${state},tokenSource:\`cached\`,token:__cdlxCachedToken}}try{let __cdlxAuthToken=await ${appServerClient}.getAuthToken({refreshToken:${refreshToken}});return{...${state},tokenSource:${refreshToken}?\`refreshed\`:\`loaded\`,token:__cdlxAuthToken}}catch(__cdlxAuthError){throw new ${errorClass}(${failureMessage},${errorStatus},__cdlxAuthError)}}`;
  const strictLength = source.startsWith('"use strict";') ? '"use strict";'.length : 0;
  const patched = source.slice(0, head.index) + replacement + source.slice(closeBrace + 1);
  return patched.slice(0, strictLength) + helper + patched.slice(strictLength);
}

module.exports = {
  applyChatGptAuthBridgePatch,
  applyChatGptDualBackendPatch,
  applyChatGptEntitlementPatch,
  applyChatGptRequestRoutingPatch,
  applyCloudAccessPatch,
  applyProductModeSwitchPatch,
  applySitesAvailabilityPatch,
  applySitesPluginAvailabilityPatch,
  chatGptSession,
  descriptors: [
    {
      id: "chatgpt-auth-bridge",
      phase: "main-bundle",
      order: 20760,
      ciPolicy: "opt-in",
      apply: applyChatGptAuthBridgePatch,
    },
    {
      id: "sites-plugin-availability",
      phase: "main-bundle",
      order: 20761,
      ciPolicy: "opt-in",
      apply: applySitesPluginAvailabilityPatch,
    },
    {
      id: "cloud-access",
      phase: "webview-asset",
      order: 20765,
      ciPolicy: "opt-in",
      pattern: /^local-remote-dropdown-.*\.js$/,
      missingDescription: "local/remote dropdown webview bundle",
      skipDescription: "Send to cloud access patch",
      apply: applyCloudAccessPatch,
    },
    {
      id: "chatgpt-request-routing",
      phase: "webview-asset",
      order: 20769,
      ciPolicy: "opt-in",
      pattern: CHAT_ENTITLEMENT_ASSET_PATTERN,
      missingDescription: "ChatGPT request client webview bundle",
      skipDescription: "ChatGPT official backend request routing patch",
      apply: applyChatGptRequestRoutingPatch,
    },
    {
      id: "chatgpt-chat-entitlement",
      phase: "webview-asset",
      order: 20770,
      ciPolicy: "opt-in",
      pattern: CHAT_ENTITLEMENT_ASSET_PATTERN,
      missingDescription: "ChatGPT Chat entitlement webview bundle",
      skipDescription: "ChatGPT Chat dual-backend entitlement patch",
      apply: applyChatGptEntitlementPatch,
    },
    {
      id: "product-mode-switch",
      phase: "webview-asset",
      order: 20771,
      ciPolicy: "opt-in",
      pattern: CHAT_ENTITLEMENT_ASSET_PATTERN,
      missingDescription: "ChatGPT/Codex product switch webview bundle",
      skipDescription: "ChatGPT/Codex product switch patch",
      apply: applyProductModeSwitchPatch,
    },
    {
      id: "sites-availability",
      phase: "webview-asset",
      order: 20800,
      ciPolicy: "opt-in",
      pattern: SITES_AVAILABILITY_ASSET_PATTERN,
      missingDescription: "ChatGPT Sites availability webview bundle",
      skipDescription: "ChatGPT Sites availability patch",
      apply: applySitesAvailabilityPatch,
    },
  ],
  internals: {
    CHAT_ENTITLEMENT_ASSET_PATTERN,
    CHAT_ENTITLEMENT_GUARD,
    CHATGPT_REQUEST_CLIENT,
    PRODUCT_MODE_SWITCH_GUARD,
    SITES_AVAILABILITY_ASSET_PATTERN,
    SITES_AVAILABILITY_GUARD,
    SITES_PLUGIN_AVAILABILITY,
  },
};
