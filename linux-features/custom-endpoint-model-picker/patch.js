"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Webview needles
// ---------------------------------------------------------------------------

const PICKER_ALLOWLIST_MARKER = "__codexLinuxCustomEndpointAllowlist";
const PICKER_NEEDLE = /((?:let )?\w+=)(?:\w+\.useHiddenModels|\w+)&&\w+!==`amazonBedrock`(?:&&\w+!==`apikey`\/\*codexLinuxApiKeyModelVisibility\*\/)?([,;])/;
const PICKER_WEBVIEW_CATALOG_MARKER = "__codexLinuxCustomEndpointWebviewModels";
const PICKER_WEBVIEW_NEEDLE = /(function \w+\(\{authMethod:\w+,availableModels:\w+,defaultModel:\w+,enabledReasoningEfforts:\w+,includeUltraReasoningEffort:\w+,models:(\w+),useHiddenModels:\w+\}\)\{)/;
const PICKER_DYNAMIC_CONFIG_MARKER = "__codexLinuxCustomEndpointDynamicConfigModels";
const PICKER_DYNAMIC_CONFIG_NEEDLE = /(return\{availableModels:new Set\()([^)]*)(\),useHiddenModels:[^,]+,defaultModel:)([^}]+)(\}\})/;
const PICKER_REASONING_FALLBACK_MARKER = "__codexLinuxCustomEndpointReasoningFallback";
const PICKER_ULTRA_MARKER = "__codexLinuxCustomEndpointUltra";
const PICKER_ULTRA_NEEDLE = /(function \w+\(\{authMethod:(\w+),availableModels:\w+,defaultModel:\w+,enabledReasoningEfforts:\w+,includeUltraReasoningEffort:(\w+),models:\w+,useHiddenModels:\w+\}\)\{)(?=let \w+=\[\],\w+=null,\w+=[^,;]+,\w+=\w+\.some\(\w+=>\w+\.supportedReasoningEfforts\.some\(\(\{reasoningEffort:\w+\}\)=>\w+===`max`\)\))/;
const PICKER_COMPOSER_MENU_MARKER = "__codexLinuxCustomEndpointComposerMenuModels";
const PICKER_COMPOSER_MENU_NEEDLE = /(let \w+=\w+,\w+=)(\w+)\?\.models(,\w+;)/;
const PICKER_REASONING_NEEDLE = /((?:,)(\w+)=\[\.\.\.(\w+)\]\.filter\(\(\{reasoningEffort:(\w+)\}\)=>(\w+)\(\4\)&&(\w+)\.has\(\4\)\)),(\w+)=\{(\.\.\.\w+,supportedReasoningEfforts:\2)([,}])/g;

// ---------------------------------------------------------------------------
// Main-bundle (app-server bridge) needles
// ---------------------------------------------------------------------------

// V3 helper: injected at the top of the chunk (after any leading directive) so
// it never depends on a minified class identifier like `nB=class`. The fresh
// V3 name deliberately differs from the legacy helper so stale builds that
// still carry the old helper/call sites get upgraded rather than skipped.
const MAIN_HELPER_MARKER = "__codexLinuxMergeCustomEndpointCatalogModelsV3=function(";
// Distinctive local prefix used by the v3 listModels rewrite. Doubles as the
// idempotency marker.
const MAIN_LIST_MODELS_APPLIED_MARKER = "__cdlxCfg";

// Pristine current listModels. Captures params var (1), request-id var
// (2), randomUUID module var (3), and response var (4) so the rewrite reuses
// the bundle's own identifiers instead of hardcoding minified names.
const MAIN_LIST_MODELS_NEEDLE = /async listModels\((\w+)\)\{await this\.ensureReady\(\);let (\w+)=`model\/list:\$\{\(0,(\w+)\.randomUUID\)\(\)\}`,(\w+)=await this\.sendInternalRequest\(\{id:\2,method:`model\/list`,params:\1\}\);if\(\4\.error\)throw Error\(\4\.error\.message\?\?`Failed to read available models`\);return \4\.result\}/;

// Runtime merge helper. Semantics:
//   * reads model_catalog_json / model from the saved config, falling back to
//     $CODEX_HOME/config.toml (double- or single-quoted values, ~ expanded);
//   * catalog entries WIN over raw provider entries with the same slug (raw
//     provider rows carry no display metadata and previously shadowed the
//     catalog because of append-only dedup);
//   * every surviving row is normalized so supportedReasoningEfforts is
//     always a non-empty array — raw provider rows (objects without effort
//     metadata, or plain string slugs) previously crashed the picker's
//     `models.some(m=>m.supportedReasoningEfforts.some(...))` selectors,
//     which renders as an empty model menu;
//   * catalog entries are emitted first in catalog order, followed by raw
//     provider-only entries; the incoming result shape ({data}, {models}, or
//     bare array) is preserved.
const MAIN_HELPER = String.raw`__codexLinuxMergeCustomEndpointCatalogModelsV3=function(e,t){try{let n=require("node:fs"),r=require("node:os"),i=require("node:path"),a=function(x){return typeof x=="string"&&x[0]==="~"?i.join(r.homedir(),x.slice(1)):x},o=t?.model_catalog_json,s=t?.model;if(typeof o!="string"||!o){let cp=i.join(process.env.CODEX_HOME||i.join(r.homedir(),".codex"),"config.toml"),cf=n.readFileSync(cp,"utf8");o=cf.match(/^\s*model_catalog_json\s*=\s*["']([^"']+)["']/m)?.[1],s??=cf.match(/^\s*model\s*=\s*["']([^"']+)["']/m)?.[1]}if(typeof o!="string"||!o)return e;let c=JSON.parse(n.readFileSync(a(o),"utf8")),l=Array.isArray(c)?c:Array.isArray(c?.models)?c.models:[],u=Array.isArray(e?.data)?e.data:Array.isArray(e?.models)?e.models:Array.isArray(e)?e:null;if(!u)return e;let d=function(list,dflt){let arr=Array.isArray(list)?list:[],out=arr.map(function(x){return{reasoningEffort:x?.effort??x?.reasoningEffort,description:x?.description??(x?.effort??x?.reasoningEffort)+" effort"}}).filter(function(x){return typeof x.reasoningEffort=="string"});return out.length?out:[{reasoningEffort:dflt??"medium",description:(dflt??"medium")+" effort"}]},f=new Map;for(let m of l){let g=m?.slug??m?.model;if(typeof g!="string"||!g)continue;let dr=m?.default_reasoning_level??m?.defaultReasoningEffort,ef=d(m?.supported_reasoning_levels??m?.supportedReasoningEfforts,dr);f.set(g,{model:g,name:m?.display_name??m?.name??g,displayName:m?.display_name??m?.name??g,description:m?.description??"",hidden:m?.visibility==="hidden",isDefault:g===s,defaultReasoningEffort:dr??ef[0].reasoningEffort,supportedReasoningEfforts:ef})}let p=new Set,q=[];for(let m of u){let g=typeof m=="string"?m:m?.model;if(typeof g=="string"&&f.has(g)){q.push(m&&typeof m=="object"?{...m,...f.get(g)}:f.get(g)),p.add(g);continue}if(typeof m=="string"){q.push({model:m,name:m,displayName:m,description:"",hidden:!1,isDefault:m===s,defaultReasoningEffort:"medium",supportedReasoningEfforts:d(null,"medium")}),p.add(m);continue}if(m&&typeof m=="object"){if(Array.isArray(m.supportedReasoningEfforts))q.push(m);else{let ef=d(null,m.defaultReasoningEffort);q.push({...m,name:m.name??m.displayName??g??"",displayName:m.displayName??m.name??g??"",defaultReasoningEffort:m.defaultReasoningEffort??ef[0].reasoningEffort,supportedReasoningEfforts:ef})}typeof g=="string"&&p.add(g);continue}q.push(m)}for(let[g,m]of f)p.has(g)||q.push(m);return Array.isArray(e?.data)?{...e,data:q}:Array.isArray(e?.models)?{...e,models:q}:q}catch{return e}}`;

function buildListModelsReplacement(paramsVar, idVar, uuidVar) {
  return (
    `async listModels(${paramsVar}){await this.ensureReady();` +
    `let ${idVar}=\`model/list:\${(0,${uuidVar}.randomUUID)()}\`,` +
    `__cdlxResp=await this.sendInternalRequest({id:${idVar},method:\`model/list\`,params:${paramsVar}}),__cdlxCfg;` +
    `try{__cdlxCfg=await this.getUserSavedConfiguration?.()}catch{}` +
    `if(__cdlxResp.error){let __cdlxFallback=__codexLinuxMergeCustomEndpointCatalogModelsV3({data:[]},__cdlxCfg);` +
    `if(__cdlxFallback.data?.length)return __cdlxFallback;` +
    `throw Error(__cdlxResp.error.message??\`Failed to read available models\`)}` +
    `let __cdlxOut=__cdlxResp.result;` +
    `try{__cdlxOut=__codexLinuxMergeCustomEndpointCatalogModelsV3(__cdlxOut,__cdlxCfg)}catch{}` +
    `return __cdlxOut}`
  );
}

function injectMainHelper(source) {
  if (source.includes(MAIN_HELPER_MARKER)) {
    return source;
  }
  const orderedMainHelper = MAIN_HELPER.replace(
    "for(let[g,m]of f)p.has(g)||q.push(m);return",
    "let z=[];for(let[g,m]of f)z.push(m);for(let m of q){let g=typeof m==\"string\"?m:m?.model;if(!f.has(g))z.push(m)}q=z;return",
  );
  // Insert after an optional hashbang and/or leading "use strict" directive so
  // the directive stays effective. Top-of-module `var` is valid in both CJS
  // and ESM output and never depends on minified identifiers.
  const head = source.match(/^(?:#![^\n]*\n)?(?:\s*(?:"use strict"|'use strict');?\n?)?/)[0];
  return `${source.slice(0, head.length)}var ${orderedMainHelper};${source.slice(head.length)}`;
}

// ---------------------------------------------------------------------------
// Build-time catalog read for the webview fallback injections
// ---------------------------------------------------------------------------

function expandHomePath(candidate) {
  if (typeof candidate === "string" && candidate.startsWith("~")) {
    return path.join(os.homedir(), candidate.slice(1));
  }
  return candidate;
}

function readCatalogModelsForWebview() {
  try {
    const configPath = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "config.toml");
    const config = fs.readFileSync(configPath, "utf8");
    const catalogPath = config.match(/^\s*model_catalog_json\s*=\s*["']([^"']+)["']/m)?.[1];
    const selectedModel = config.match(/^\s*model\s*=\s*["']([^"']+)["']/m)?.[1];
    if (typeof catalogPath !== "string" || catalogPath.length === 0) {
      return [];
    }
    const catalog = JSON.parse(fs.readFileSync(expandHomePath(catalogPath), "utf8"));
    const models = Array.isArray(catalog) ? catalog : Array.isArray(catalog?.models) ? catalog.models : [];
    return models.flatMap((model) => {
      const slug = model?.slug ?? model?.model;
      if (typeof slug !== "string" || slug.length === 0) {
        return [];
      }
      const efforts = (model?.supported_reasoning_levels ?? model?.supportedReasoningEfforts ?? [])
        .map((effort) => ({
          reasoningEffort: effort?.effort ?? effort?.reasoningEffort,
          description: effort?.description ?? `${effort?.effort ?? effort?.reasoningEffort} effort`,
        }))
        .filter((effort) => typeof effort.reasoningEffort === "string");
      const defaultReasoningEffort = model?.default_reasoning_level ?? model?.defaultReasoningEffort ?? efforts[0]?.reasoningEffort ?? "medium";
      return [{
        model: slug,
        name: model?.display_name ?? model?.name ?? slug,
        displayName: model?.display_name ?? model?.name ?? slug,
        description: model?.description ?? "",
        hidden: model?.visibility === "hidden",
        isDefault: slug === selectedModel,
        defaultReasoningEffort,
        supportedReasoningEfforts: efforts.length ? efforts : [{ reasoningEffort: defaultReasoningEffort, description: `${defaultReasoningEffort} effort` }],
      }];
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Webview patches
// ---------------------------------------------------------------------------

function applyModelPickerAllowlistPatch(source) {
  if (!source.includes(PICKER_ULTRA_MARKER) && PICKER_ULTRA_NEEDLE.test(source)) {
    source = source.replace(
      PICKER_ULTRA_NEEDLE,
      (_match, prefix, authMethodVar, includeUltraVar) =>
        `${prefix}let ${PICKER_ULTRA_MARKER}=${authMethodVar}===\`apikey\`||${authMethodVar}===\`apiKey\`;${includeUltraVar}=${includeUltraVar}||${PICKER_ULTRA_MARKER};`,
    );
  }
  const webviewCatalogModels = readCatalogModelsForWebview();
  if (webviewCatalogModels.length > 0 && !source.includes(PICKER_COMPOSER_MENU_MARKER)) {
    const modelsJson = JSON.stringify(webviewCatalogModels);
    const mergeExpr = (modelsExpr) =>
      `(()=>{let ${PICKER_COMPOSER_MENU_MARKER}=${modelsJson},e=${modelsExpr};return[...${PICKER_COMPOSER_MENU_MARKER},...(e??[]).filter(e=>Array.isArray(e?.supportedReasoningEfforts)&&!${PICKER_COMPOSER_MENU_MARKER}.some(t=>t.model===e.model))]})()`;
    source = source.replace(PICKER_COMPOSER_MENU_NEEDLE, (_match, prefix, dataVar, suffix) =>
      `${prefix}${mergeExpr(`${dataVar}?.models`)}${suffix}`,
    );
  }
  if (webviewCatalogModels.length > 0 && !source.includes(PICKER_DYNAMIC_CONFIG_MARKER) && PICKER_DYNAMIC_CONFIG_NEEDLE.test(source)) {
    const slugsJson = JSON.stringify(webviewCatalogModels.map((model) => model.model));
    source = source.replace(
      PICKER_DYNAMIC_CONFIG_NEEDLE,
      (_match, prefix, availableExpr, middle, defaultExpr, suffix) =>
        `${prefix}(()=>{let ${PICKER_DYNAMIC_CONFIG_MARKER}=${slugsJson},e=${availableExpr};return[...new Set([...e,...${PICKER_DYNAMIC_CONFIG_MARKER}])]})()${middle}${defaultExpr}${suffix}`,
    );
  }
  if (webviewCatalogModels.length > 0 && !source.includes(PICKER_WEBVIEW_CATALOG_MARKER) && PICKER_WEBVIEW_NEEDLE.test(source)) {
    const modelsJson = JSON.stringify(webviewCatalogModels);
    source = source.replace(
      PICKER_WEBVIEW_NEEDLE,
      (_match, prefix, modelsVar) =>
        `${prefix}let ${PICKER_WEBVIEW_CATALOG_MARKER}=${modelsJson};${modelsVar}=[...${PICKER_WEBVIEW_CATALOG_MARKER},...${modelsVar}.filter(e=>Array.isArray(e?.supportedReasoningEfforts)&&!${PICKER_WEBVIEW_CATALOG_MARKER}.some(t=>t.model===e.model))];`,
    );
  }
  if (!source.includes(PICKER_REASONING_FALLBACK_MARKER)) {
    source = source.replace(
      PICKER_REASONING_NEEDLE,
      `$1;${PICKER_REASONING_FALLBACK_MARKER}:if(!$2.length)$2=$3.filter(({reasoningEffort:$4})=>$5($4));let $7={$8$9`,
    );
  }
  if (source.includes(PICKER_ALLOWLIST_MARKER)) {
    return source;
  }
  if (!PICKER_NEEDLE.test(source)) {
    if (/function \w+\(\{authMethod:\w+,availableModels:\w+,defaultModel:\w+,enabledReasoningEfforts:\w+,includeUltraReasoningEffort:\w+,models:\w+,useHiddenModels:\w+\}\)/.test(source)) {
      console.warn(
        "WARN: Could not find model picker allowlist guard — skipping custom-endpoint-model-picker allowlist patch",
      );
    }
    return source;
  }
  return source.replace(PICKER_NEEDLE, `$1!1/*${PICKER_ALLOWLIST_MARKER}*/$2`);
}

// ---------------------------------------------------------------------------
// Main-bundle patch
// ---------------------------------------------------------------------------

function applyMainBundleCatalogModelsPatch(source) {
  if (!source.includes("model/list")) {
    return source;
  }
  if (source.includes(MAIN_LIST_MODELS_APPLIED_MARKER)) {
    return source;
  }
  if (!MAIN_LIST_MODELS_NEEDLE.test(source)) {
    if (/async listModels\(/.test(source)) {
      console.warn(
        "WARN: Could not find model/list bridge — skipping custom-endpoint-model-picker catalog model patch",
      );
    }
    return source;
  }
  return injectMainHelper(source).replace(
    MAIN_LIST_MODELS_NEEDLE,
    (_match, paramsVar, idVar, uuidVar) => buildListModelsReplacement(paramsVar, idVar, uuidVar),
  );
}

function applyExtractedAppCatalogModelsPatch(extractedDir) {
  const buildDir = path.join(extractedDir, ".vite", "build");
  if (!fs.existsSync(buildDir)) {
    console.warn(
      "WARN: Could not find .vite build directory — skipping custom-endpoint-model-picker catalog model patch",
    );
    return { changed: false };
  }
  let matched = 0;
  let changed = 0;
  for (const name of fs.readdirSync(buildDir).filter((name) => name.endsWith(".js")).sort()) {
    const file = path.join(buildDir, name);
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes("model/list")) {
      continue;
    }
    matched += 1;
    const patched = applyMainBundleCatalogModelsPatch(source);
    if (patched !== source) {
      fs.writeFileSync(file, patched);
      changed += 1;
    }
  }
  if (matched === 0) {
    console.warn(
      "WARN: Could not find model/list bridge bundle — skipping custom-endpoint-model-picker catalog model patch",
    );
  }
  return { changed: changed > 0, matched, changedFiles: changed };
}

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

const MODEL_PICKER_ASSET_PATTERN = /^app-initial-[^.]+\.js$/;
const COMPOSER_MENU_ASSET_PATTERN = /^app-initial-[^.]+\.js$/;

module.exports = {
  descriptors: [
    {
      id: "main-bundle-catalog-models",
      name: "custom-endpoint-model-picker-catalog-models",
      phase: "extracted-app:post-webview",
      order: 20510,
      apply: applyExtractedAppCatalogModelsPatch,
    },
    {
      id: "model-picker-allowlist",
      name: "custom-endpoint-model-picker-allowlist",
      phase: "webview-asset",
      pattern: MODEL_PICKER_ASSET_PATTERN,
      missingDescription: "model picker bundle",
      skipDescription: "custom-endpoint-model-picker allowlist patch",
      apply: applyModelPickerAllowlistPatch,
    },
    {
      id: "composer-menu-models",
      name: "custom-endpoint-model-picker-composer-menu-models",
      phase: "webview-asset",
      pattern: COMPOSER_MENU_ASSET_PATTERN,
      missingDescription: "composer model menu bundle",
      skipDescription: "custom-endpoint-model-picker composer model menu patch",
      apply: applyModelPickerAllowlistPatch,
    },
  ],
  applyExtractedAppCatalogModelsPatch,
  applyMainBundleCatalogModelsPatch,
  applyModelPickerAllowlistPatch,
  readCatalogModelsForWebview,
  internals: {
    MODEL_PICKER_ASSET_PATTERN,
    COMPOSER_MENU_ASSET_PATTERN,
    MAIN_HELPER_MARKER,
    MAIN_LIST_MODELS_APPLIED_MARKER,
    MAIN_LIST_MODELS_NEEDLE,
    PICKER_ALLOWLIST_MARKER,
    PICKER_NEEDLE,
    PICKER_WEBVIEW_CATALOG_MARKER,
    PICKER_WEBVIEW_NEEDLE,
    PICKER_DYNAMIC_CONFIG_MARKER,
    PICKER_DYNAMIC_CONFIG_NEEDLE,
    PICKER_REASONING_FALLBACK_MARKER,
    PICKER_ULTRA_MARKER,
    PICKER_ULTRA_NEEDLE,
    PICKER_COMPOSER_MENU_MARKER,
    PICKER_COMPOSER_MENU_NEEDLE,
    PICKER_REASONING_NEEDLE,
  },
};
