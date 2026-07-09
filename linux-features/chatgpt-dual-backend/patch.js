"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PATCH_MARKER = "__codexLinuxChatGptBackendSession";
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

module.exports = {
  applyChatGptDualBackendPatch,
  chatGptSession,
  descriptors: [
    {
      id: "chatgpt-chat-sites-entitlement",
      phase: "webview-asset",
      order: 20800,
      ciPolicy: "opt-in",
      pattern: /^app-initial~app-main~.*(?:chatgpt|quick-chat).*\.js$/,
      missingDescription: "ChatGPT Chat/Sites webview bundle",
      skipDescription: "ChatGPT Chat/Sites dual-backend entitlement patch",
      apply: applyChatGptDualBackendPatch,
    },
  ],
};
