# Custom Endpoint Marketplace

Keeps official marketplaces visible when using a custom model provider endpoint.

## What it does

The Codex webview hides curated marketplaces (`openai-curated`, `openai-curated-remote`)
when the auth method is non-standard. Custom endpoints (9router, Ollama, etc.) trigger
this hiding, so the "OpenAI Marketplace" and "Anthropic Marketplace" tabs disappear.

This feature patches the shared plugins webview bundle to disable the
auth-method-based and statsig-gate-based marketplace hiding. The latest bundle
memoizes that auth check, so the patch forces its resulting hide flag to
`false`.

### Patched logic

Before:
```js
h=ve;m?h=xe:p&&(h=be)  // can reassign h to hide marketplaces
```

After:
```js
h=ve;0                  // h always stays ve (hide nothing)
```

Where `ve = []` (empty array), `xe = ["openai-curated", "openai-curated-remote"]`,
`be = ["openai-curated"]`.

## Enabling

Add both feature ids to `linux-features/features.json`:

```json
{
  "enabled": [
    "custom-endpoint-model-picker",
    "custom-endpoint-marketplace"
  ]
}
```

Then rebuild:

```bash
./install.sh ./Codex.dmg
```

## Requirements

Requires `custom-endpoint-model-picker` — the model picker must also be patched
since marketplaces and model selection UI are linked.

## Testing

```bash
node --test linux-features/local/custom-endpoint-marketplace/test.js
node linux-features/local/custom-endpoint-marketplace/eval.js
```

## Risks

- Targets a minified, hashed webview asset. Needle may drift on upstream changes.
- Descriptor is optional; mismatch warns instead of failing the build.
- Does NOT make remote-only plugins installable without API access — it only
  makes the marketplace UI tabs visible. Plugins with `source.type === "remote"`
  still require API connectivity to install.
