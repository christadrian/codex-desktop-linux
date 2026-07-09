"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { applyChatGptDualBackendPatch, chatGptSession } = require("./patch.js");

const fixture =
  "function F8e({accountId:e,accountLoading:t,additionalRolloutEnabled:n,authLoading:r,authMethod:i,authenticatedAccountId:a,plan:o,rolloutEnabled:s,supportedSurface:c}){return c?!s&&!n?{status:`denied`,reason:`rollout-disabled`}:r&&i==null?{status:`loading`}:i===`chatgpt`?t&&(e==null||o==null)?{status:`loading`}:a==null||e==null?{status:`denied`,reason:`missing-account`}:a===e?R8e(o)?{status:`allowed`,accountId:e,plan:o}:{status:`denied`,reason:`unsupported-plan`}:{status:`denied`,reason:`account-mismatch`}:{status:`denied`,reason:`not-chatgpt-auth`}:{status:`denied`,reason:`unsupported-surface`}}/* /wham/sites/access */";

function withAuth(auth, fn) {
  const oldHome = process.env.CODEX_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-chatgpt-dual-backend-"));
  process.env.CODEX_HOME = home;
  try {
    fs.writeFileSync(path.join(home, "auth.json"), JSON.stringify(auth));
    return fn();
  } finally {
    oldHome == null ? delete process.env.CODEX_HOME : process.env.CODEX_HOME = oldHome;
    fs.rmSync(home, { recursive: true, force: true });
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
