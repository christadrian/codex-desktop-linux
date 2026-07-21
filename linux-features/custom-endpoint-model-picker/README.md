# Custom Endpoint Model Picker

Expose the current model picker and composer model menu when Codex Desktop is
configured to use a custom model provider endpoint.

## How the model list actually works

The picker consumes the app-server's `model/list` result. A local catalog is an
optional metadata and failure fallback when a provider returns incomplete rows
or cannot list its models. Configure it in `~/.codex/config.toml` (or
`$CODEX_HOME/config.toml`):

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
2. **Current model-picker webview bundle** — uses the exact current upstream
   asset family, removes the provider allowlist guard that suppresses custom
   models, and (when the catalog is readable at build time) bakes the catalog
   into the picker component and dynamic `available_models` config.
   Custom endpoints also bypass the upstream Ultra rollout gate, so a catalog
   entry declaring `ultra` exposes both Advanced and Ultra controls.
3. **Current composer model-menu bundle** — uses a separate exact descriptor
   so catalog models reach new-thread and Quick Chat model selection without
   letting an unrelated chunk report false patch success.

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

The patches only exist at build time, so catalog changes that should be baked
into the webview require a rebuild. The main-process merge reads the optional
catalog at runtime.

## Verifying an install (doctor)

```bash
node linux-features/custom-endpoint-model-picker/doctor.js            # default: ./codex-app
node linux-features/custom-endpoint-model-picker/doctor.js --install-dir /path/to/install
node linux-features/custom-endpoint-model-picker/doctor.js --extracted /path/to/extracted-app
```

The doctor validates the optional catalog, patch-report statuses, current
`listModels` bridge inside the installed `app.asar`, and exact current picker
and composer asset routes. Exit code 0 means the installed feature is wired to
the current upstream bundles.

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
