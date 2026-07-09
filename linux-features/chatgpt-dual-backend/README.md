# ChatGPT Chat and Sites with Custom Endpoints

Keeps Codex task/model traffic on the configured custom endpoint while enabling
the desktop's built-in ChatGPT backend for Chat and Sites.

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
