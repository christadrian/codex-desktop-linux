# Custom Endpoint Model Picker

Expose the model picker UI when Codex Desktop is configured to use a custom
model provider endpoint, keep all-provider history visible, and hide untitled
placeholder rows from the sidebar.

## What it does

Upstream Codex Desktop hides or disables the model picker for non-OpenAI
providers. When you configure a custom endpoint via `~/.codex/config.toml`,
the app may therefore not let you choose between models served by that
endpoint.

This feature patches one app-server chunk and two webview assets at build time:

1. The app-server `model/list` bridge — reads the configured
   `model_catalog_json` from `~/.codex/config.toml` and appends those catalog
   models to the list returned to the webview.
2. The model-list webview bundle — removes the provider allowlist guard
   that suppresses the model picker.
3. The recent-threads webview bundle — two loader paths:
   - **Old direct loader** (pre `getCompatibleThreadSortKey`): changes
     `modelProviders: null` to `modelProviders: []` so threads are not
     filtered by provider. Preserves `useStateDbOnly` if present.
   - **Current async state-DB loader** (has `getCompatibleThreadSortKey`):
     changes `modelProviders: null` to `modelProviders: []` and
     `sourceKinds: <var>` to `sourceKinds: []`. This follows the app-server
     contract: empty arrays mean all providers and default interactive
     sources (`cli`, `vscode`). It also filters untitled rows before they
     reach the sidebar, preventing stale blank threads from rendering as
     the fallback "New chat" label.

## Enabling

Add the feature id to `linux-features/features.json`:

```json
{
  "enabled": [
    "custom-endpoint-model-picker"
  ]
}
```

Then rebuild:

```bash
./install.sh ./Codex.dmg
```

For native packages the feature list is preserved in the update-builder
bundle, so `codex-update-manager` rebuilds keep it enabled.

## Testing

```bash
node --test linux-features/custom-endpoint-model-picker/test.js
node linux-features/custom-endpoint-model-picker/eval.js
```

## Risks

The patch targets minified, hashed app-server and webview asset files. When the
upstream app changes significantly, the regex needles may drift. The
descriptors are marked optional, so a mismatch will warn instead of failing the
build. Re-enablement after an upstream update may require updating the needles.

The blank-row filter keys off the current minified `runRecentConversationRefresh`
shape. If upstream rewrites that method, the test fixture should be updated
from the new bundle before changing the regex.
