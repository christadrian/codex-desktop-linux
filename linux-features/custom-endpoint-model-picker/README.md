# Custom Endpoint Model Picker

Expose the model picker UI when Codex Desktop is configured to use a custom
model provider endpoint, keep all-provider history visible, and hide untitled
placeholder rows from the sidebar.

## How the model list actually works

**The picker never queries the custom endpoint for its models** (no
`/v1/models` call). The list comes exclusively from a local catalog file that
you author, referenced from `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`):

```toml
model = "cx/gpt-5.5"                # optional: marks the default entry
model_provider = "ninerouter"
model_catalog_json = "/home/you/.codex/model-catalogs/custom-models.json"
```

Both `"double"` and `'single'` quoted values are accepted, and a leading `~`
is expanded. The catalog is either a bare array or `{ "models": [...] }`:

```json
{
  "models": [
    {
      "slug": "cx/gpt-5.5",
      "display_name": "GPT-5.5",
      "description": "GPT-5.5 via local 9router.",
      "default_reasoning_level": "medium",
      "supported_reasoning_levels": [
        { "effort": "low",    "description": "Fast responses" },
        { "effort": "medium", "description": "Balanced" },
        { "effort": "high",   "description": "Deep reasoning" }
      ]
    }
  ]
}
```

`visibility: "hidden"` hides an entry; `slug`/`model`, `display_name`/`name`,
and `supported_reasoning_levels`/`supportedReasoningEfforts` spellings are both
accepted.

## What it patches

1. **App-server `model/list` bridge** (`.vite/build` chunk inside `app.asar`) —
   rewrites `listModels` so the catalog is merged into every result:
   - **catalog entries win** over raw provider rows with the same slug (raw
     rows carry no display metadata);
   - every surviving row is **normalized** so `supportedReasoningEfforts` is
     always a non-empty array — raw provider rows previously crashed the
     picker's `models.some(m => m.supportedReasoningEfforts.some(...))`
     selectors, which renders as an *empty* model menu;
   - when the provider's `model/list` errors, the catalog is returned instead
     of throwing;
   - the bundle's own minified identifiers are captured and reused (no
     hardcoded `o.randomUUID` / `nB=class` anchors), the injected locals are
     `__cdlx`-prefixed to avoid collisions, and the helper is injected at the
     top of the chunk after any `"use strict"` directive;
   - stale v1/v2 patched bundles from earlier feature revisions are upgraded
     in place.
2. **Model-list webview bundle** — removes the provider allowlist guard that
   suppresses the picker, and (when the catalog is readable at build time)
   bakes the catalog into the picker component, the dynamic
   `available_models` config, and the composer/slash-command menu model reads.
   The guard removal composes with the optional `api-key-model-visibility`
   feature when both features patch the same model-list bundle.
   Custom endpoints also bypass the upstream Ultra rollout gate, so a catalog
   entry declaring `ultra` exposes both Advanced and Ultra controls.
3. **Recent-threads webview bundle** — `modelProviders: []` +
   `sourceKinds: []` per the app-server contract (all providers, default
   interactive sources), and filters untitled placeholder rows.

## Enabling

Add the feature id to `linux-features/features.json` (gitignored — create it
if needed):

```json
{
  "enabled": [
    "custom-endpoint-model-picker"
  ]
}
```

Then rebuild and reinstall:

```bash
./install.sh ./Codex.dmg
# or: make build-app DMG=... && make package && make install
```

The patches only exist at build time, so config/catalog changes that should be
baked into the webview require a rebuild; the main-process merge reads the
catalog at runtime.

## Verifying an install (doctor)

```bash
node linux-features/custom-endpoint-model-picker/doctor.js            # default: ./codex-app
node linux-features/custom-endpoint-model-picker/doctor.js --install-dir /path/to/install
node linux-features/custom-endpoint-model-picker/doctor.js --extracted /path/to/extracted-app
```

The doctor validates the config + catalog, the patch-report statuses, which
`listModels` shape is inside the installed `app.asar` (pristine / stale v1 /
stale v2 / current v3), and the webview chunks — and tells you exactly what to
fix. Exit code 0 means the install should list your catalog models.

## Testing

```bash
node --test linux-features/custom-endpoint-model-picker/test.js
node linux-features/custom-endpoint-model-picker/eval.js
```

## Risks

The patch targets minified, hashed app-server and webview asset files. When
the upstream app changes significantly, the regex needles may drift. The
descriptors are marked optional, so a mismatch warns instead of failing the
build — run the doctor after every upstream update, and re-extract fixtures
from the new bundle before adjusting needles.

The history cleanup only converts the stale `modelProviders:[]` patch back to
upstream's `modelProviders:null`. This keeps official and custom endpoint
threads in the same history after switching endpoints.
