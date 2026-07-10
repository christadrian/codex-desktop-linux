"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  findMatchingBrace,
  requireName,
} = require("../../scripts/patches/lib/minified-js.js");

const PATCH_MARKER = "__codexLinuxChatGptBackendSession";
const CHAT_NAV_MARKER = "__codexLinuxChatGptNavVisible";
const AUTH_BRIDGE_MARKER = "__codexLinuxChatGptSavedAuthToken";
const SITES_GUARD =
  /(function [A-Za-z_$][\w$]*\(\{accountId:([A-Za-z_$][\w$]*),accountLoading:([A-Za-z_$][\w$]*),additionalRolloutEnabled:([A-Za-z_$][\w$]*),authLoading:([A-Za-z_$][\w$]*),authMethod:([A-Za-z_$][\w$]*),authenticatedAccountId:[A-Za-z_$][\w$]*,plan:[A-Za-z_$][\w$]*,rolloutEnabled:([A-Za-z_$][\w$]*),supportedSurface:([A-Za-z_$][\w$]*)\}\)\{return )/;

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

function applyChatGptDualBackendPatch(source) {
  if (source.includes(PATCH_MARKER)) return source;
  const session = chatGptSession();
  if (session == null) {
    if (source.includes("not-chatgpt-auth") && source.includes("/wham/sites/access")) {
      console.warn("WARN: No ChatGPT session in ~/.codex/auth.json — skipping ChatGPT Chat/Sites dual-backend patch");
    }
    return source;
  }

  const patched = source.replace(
    SITES_GUARD,
    (_match, prefix, _accountId, _accountLoading, additionalRolloutEnabled, _authLoading, authMethod, rolloutEnabled, supportedSurface) =>
      `const ${PATCH_MARKER}=${JSON.stringify(session.accountId)};${prefix}${supportedSurface}&&${authMethod}!==\`chatgpt\`?(!${rolloutEnabled}&&!${additionalRolloutEnabled}?{status:\`denied\`,reason:\`rollout-disabled\`}:{status:\`allowed\`,accountId:${PATCH_MARKER},plan:null}):`,
  );

  if (patched === source && source.includes("not-chatgpt-auth") && source.includes("/wham/sites/access")) {
    console.warn("WARN: Could not find ChatGPT Chat/Sites entitlement guard — skipping ChatGPT dual-backend patch");
  }
  return patched;
}

function applyChatNavigationPatch(source) {
  if (source.includes(CHAT_NAV_MARKER)) return source;
  if (chatGptSession() == null) {
    if (source.includes("sidebarElectron.quickChatNavLink")) {
      console.warn("WARN: No ChatGPT session in ~/.codex/auth.json — skipping Chat navigation patch");
    }
    return source;
  }
  const needle =
    /(,[A-Za-z_$][\w$]*=)!+[A-Za-z_$][\w$]*&&[A-Za-z_$][\w$]*===`hidden`/;
  const patched = source.replace(needle, `$1!1/*${CHAT_NAV_MARKER}*/`);
  if (patched === source && source.includes("sidebarElectron.quickChatNavLink")) {
    console.warn("WARN: Could not find Chat navigation visibility guard — skipping Chat navigation patch");
  }
  return patched;
}

function applyChatGptAuthBridgePatch(source) {
  if (source.includes(AUTH_BRIDGE_MARKER)) return source;
  const fsVar = requireName(source, "node:fs") ?? requireName(source, "fs");
  const osVar = requireName(source, "node:os") ?? requireName(source, "os");
  const pathVar = requireName(source, "node:path") ?? requireName(source, "path");
  const headPattern = /async function ([A-Za-z_$][\w$]*)\(\{appServerClient:([A-Za-z_$][\w$]*),errorStatus:([A-Za-z_$][\w$]*),failureMessage:([A-Za-z_$][\w$]*),refreshToken:([A-Za-z_$][\w$]*),state:([A-Za-z_$][\w$]*)\}\)\{/;
  const head = source.match(headPattern);
  if (fsVar == null || osVar == null || pathVar == null || head == null) {
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
  const helper = `function ${AUTH_BRIDGE_MARKER}(){try{let e=${fsVar}.readFileSync(${pathVar}.join(process.env.CODEX_HOME||${pathVar}.join(process.env.HOME||${osVar}.homedir(),\`.codex\`),\`auth.json\`),\`utf8\`),t=JSON.parse(e)?.tokens?.access_token;return typeof t===\`string\`&&t.length>0?t:void 0}catch{return void 0}}`;
  const replacement = `async function ${functionName}({appServerClient:${appServerClient},errorStatus:${errorStatus},failureMessage:${failureMessage},refreshToken:${refreshToken},state:${state}}){if(!${state}.attachAuth)return ${state};if(!${refreshToken}){let __cdlxCachedToken=${appServerClient}.getCachedAuthToken?.();if(typeof __cdlxCachedToken===\`string\`&&__cdlxCachedToken.length>0)return{...${state},tokenSource:\`cached\`,token:__cdlxCachedToken}}try{let __cdlxAuthToken=await ${appServerClient}.getAuthToken({refreshToken:${refreshToken}});if(typeof __cdlxAuthToken!==\`string\`||__cdlxAuthToken.length===0)__cdlxAuthToken=${AUTH_BRIDGE_MARKER}();return{...${state},tokenSource:__cdlxAuthToken===void 0?${refreshToken}?\`refreshed\`:\`loaded\`:\`saved-chatgpt\`,token:__cdlxAuthToken}}catch(__cdlxAuthError){let __cdlxSavedToken=${AUTH_BRIDGE_MARKER}();if(__cdlxSavedToken!==void 0)return{...${state},tokenSource:\`saved-chatgpt\`,token:__cdlxSavedToken};throw new ${errorClass}(${failureMessage},${errorStatus},__cdlxAuthError)}}`;
  const strictLength = source.startsWith('"use strict";') ? '"use strict";'.length : 0;
  const patched = source.slice(0, head.index) + replacement + source.slice(closeBrace + 1);
  return patched.slice(0, strictLength) + helper + patched.slice(strictLength);
}

module.exports = {
  applyChatGptAuthBridgePatch,
  applyChatGptDualBackendPatch,
  applyChatNavigationPatch,
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
      id: "chat-navigation",
      phase: "webview-asset",
      order: 20770,
      ciPolicy: "opt-in",
      pattern: /^app-initial~app-main~page-.*\.js$/,
      missingDescription: "Chat navigation webview bundle",
      skipDescription: "Chat navigation visibility patch",
      apply: applyChatNavigationPatch,
    },
    {
      id: "chatgpt-chat-sites-entitlement",
      phase: "webview-asset",
      order: 20800,
      ciPolicy: "opt-in",
      pattern: /^app-initial~app-main~.*\.js$/,
      missingDescription: "ChatGPT Chat/Sites webview bundle",
      skipDescription: "ChatGPT Chat/Sites dual-backend entitlement patch",
      apply: applyChatGptDualBackendPatch,
    },
  ],
};
