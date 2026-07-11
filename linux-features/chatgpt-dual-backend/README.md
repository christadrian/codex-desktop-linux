# ChatGPT Chat and Sites with Custom Endpoints

Keeps Codex task/model traffic on the configured custom endpoint while enabling
the desktop's built-in ChatGPT backend for Chat, Sites, and Codex Cloud.

The feature keeps the upstream Chat navigation row visible when a valid saved
ChatGPT session exists. It also keeps Sites available after switching Codex task
traffic to a custom endpoint such as 9router, including retaining the bundled
Sites plugin when upstream endpoint-derived feature flags omit it. The
run-location menu also keeps every Codex Cloud gate enabled, so configured
cloud environments remain selectable. It
does not show these surfaces
when `auth.json` has no usable session.

The entitlement patch scans all `app-initial~app-main~*.js` chunks because
upstream truncates long chunk names before the `chatgpt` segment.

When a custom endpoint is active, the app-server may not expose ChatGPT Sites
rollout flags or the ChatGPT access token. The feature treats Sites as available
when the saved ChatGPT session is valid. For OpenAI-owned requests that already
ask the desktop fetch bridge to attach authentication, it falls back to the
saved `auth.json` access token in the main process before consulting the
custom endpoint's cached token. This prevents Chat history, Sites, and Cloud
requests from receiving a cached custom-provider credential. The token is never embedded in the
webview, and the upstream allowlist still prevents attaching it to non-OpenAI
URLs.

The feature requires a valid `~/.codex/auth.json` with both
`tokens.access_token` and `tokens.account_id`. It does not copy or embed the
token. Upstream's ChatGPT client continues to make its own authenticated
requests to the ChatGPT backend; the patch only preserves the upstream rollout
gate and replaces the custom-endpoint `not-chatgpt-auth` denial with the saved
ChatGPT account identity.

Enable locally:

```json
{
  "enabled": [
    "custom-endpoint-model-picker",
    "chatgpt-dual-backend"
  ]
}
```

Rebuild:

```bash
./install.sh ./Codex.dmg
```

Validate:

```bash
node --test linux-features/chatgpt-dual-backend/test.js
node linux-features/chatgpt-dual-backend/eval.js
```

If ChatGPT access expires, sign in again with the Codex CLI and rebuild. The
feature intentionally stays disabled when no saved ChatGPT session exists.
