# ChatGPT Chat and Sites with Custom Endpoints

Keeps Codex task/model traffic on the configured custom endpoint while enabling
the desktop's built-in ChatGPT backend for Chat, Sites, and Codex Cloud.

The feature keeps the upstream Chat mode and Quick Chat entitlement available
when a valid saved ChatGPT session exists. It also keeps Sites available after
switching Codex task traffic to a custom endpoint such as 9router, including
retaining the current bundled ChatGPT plugin when upstream endpoint-derived
feature flags omit `sites`. That plugin owns the ChatGPT surface switch and
conversation-history UI, so entitlement and request routing alone are not
enough. The bundled plugin remains eligible without relying on a runtime
`platform` field that upstream no longer supplies to plugin availability
callbacks. The run-location menu also keeps every Codex Cloud gate enabled, so
configured cloud environments remain selectable. It does not show these
surfaces when `auth.json` has no usable session.

Current upstream keeps the Chat/Quick Chat entitlement and Sites availability
in different shared chunks. The feature routes independent patches to the exact
current bundle families. This prevents an unrelated old chunk from reporting
the feature as applied while the live entitlement remains denied.

The dedicated ChatGPT client is also pinned to
`https://chatgpt.com/backend-api`. Its `/models`, `/conversations`,
`/conversation/*`, and `/gizmos/*` requests therefore cannot inherit the
custom Codex endpoint. Other API clients are unchanged, so Codex and Cowork
model/task traffic stays on the configured custom endpoint.

When a custom endpoint is active, the app-server may not expose ChatGPT Sites
availability or the ChatGPT access token. The feature patches the Sites access
atom directly when a saved ChatGPT session is valid. This avoids depending on
an entitlement chunk to initialize shared global state before the separate
Sites chunk evaluates. For OpenAI-owned requests that already
ask the desktop fetch bridge to attach authentication, it falls back to the
saved `auth.json` access token in the main process before consulting the
custom endpoint's cached token. This prevents Chat history, Sites, and Cloud
requests from receiving a cached custom-provider credential. The token is never embedded in the
webview, and the upstream allowlist still prevents attaching it to non-OpenAI
URLs. The auth reader uses direct Node built-ins instead of inferred minified
module aliases, which may be function-scoped and unavailable to injected
top-level helpers.

The feature requires a valid `~/.codex/auth.json` with both
`tokens.access_token` and `tokens.account_id`. It does not copy or embed the
token. Upstream's ChatGPT client continues to make its own authenticated
requests to the ChatGPT backend; the patch replaces only the custom-endpoint
`not-chatgpt-auth` denial with the saved ChatGPT account identity. Official
ChatGPT-authenticated sessions continue through the unmodified upstream branch.
The custom-endpoint allowance does not depend on `supportedSurface`: upstream
sets that value from the ChatGPT surface itself, so requiring it before the
surface mounts creates a circular gate that hides the switch and history UI.

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

The routing regression test executes both clients. It requires the ChatGPT
client to resolve `/models` against the official backend and the generic client
to leave `/models` relative for custom-endpoint handling. The plugin regression
test uses the current consolidated main-bundle descriptor and requires the
ChatGPT plugin to remain installable only when saved ChatGPT authentication is
valid. The entitlement regression executes the current guard with
`supportedSurface: false`, matching custom-endpoint startup before the ChatGPT
surface mounts.

If ChatGPT access expires, sign in again with the Codex CLI and rebuild. The
feature intentionally stays disabled when no saved ChatGPT session exists.
