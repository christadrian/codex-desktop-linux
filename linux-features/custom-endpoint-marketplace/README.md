# Custom Endpoint Marketplace

Keeps official marketplaces visible when using a custom model provider endpoint.

## What it does

The Codex webview hides curated marketplaces (`openai-curated`, `openai-curated-remote`)
when the auth method is non-standard. Custom endpoints (9router, Ollama, etc.) trigger
this hiding, so the "OpenAI Marketplace" and "Anthropic Marketplace" tabs disappear.

This feature patches the current shared plugins hook to force its memoized
`shouldHideOpenAICuratedMarketplaces` value to `false`. The independent remote
marketplace rollout gate remains unchanged.

### Patched logic

Before:
```js
let p=f,m=includeRemoteCatalog // f is the memoized auth hide flag
```

After:
```js
let p=false,m=includeRemoteCatalog
```

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
node --test linux-features/custom-endpoint-marketplace/test.js
node linux-features/custom-endpoint-marketplace/eval.js
```

## Risks

- Targets a minified, hashed webview asset. Needle may drift on upstream changes.
- Descriptor is optional; mismatch warns instead of failing the build.
- Does NOT make remote-only plugins installable without API access — it only
  makes the marketplace UI tabs visible. Plugins with `source.type === "remote"`
  still require API connectivity to install.
