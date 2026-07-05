"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PICKER_NEEDLE = /((?:let )?\w+=)(?:\w+\.useHiddenModels|\w+)&&\w+!==`amazonBedrock`([,;])/;
const PICKER_CURRENT_NEEDLE = /(,\w+=)(?:\w+\.useHiddenModels|\w+)&&\w+!==`amazonBedrock`(;return \w+\.forEach\()/;
const PICKER_CURRENT_APPLIED = /function \w+\(\{authMethod:\w+,availableModels:\w+,defaultModel:\w+,enabledReasoningEfforts:\w+,includeUltraReasoningEffort:\w+,models:\w+,useHiddenModels:\w+\}\)\{let \w+=\[\],\w+=null,\w+=!1,/;
const PICKER_WEBVIEW_CATALOG_MARKER = "__codexLinuxCustomEndpointWebviewModels";
const PICKER_WEBVIEW_NEEDLE = /(function \w+\(\{authMethod:\w+,availableModels:\w+,defaultModel:\w+,enabledReasoningEfforts:\w+,includeUltraReasoningEffort:\w+,models:(\w+),useHiddenModels:\w+\}\)\{)/;
const PICKER_DYNAMIC_CONFIG_MARKER = "__codexLinuxCustomEndpointDynamicConfigModels";
const PICKER_DYNAMIC_CONFIG_NEEDLE = /(return\{availableModels:new Set\()([^)]*)(\),useHiddenModels:[^,]+,defaultModel:)([^}]+)(\}\})/;
const MAIN_HELPER_MARKER = "__codexLinuxMergeCustomEndpointCatalogModels=function(";
const MAIN_CLASS_NEEDLE = "nB=class";
const MAIN_LIST_MODELS_NEEDLE = /async listModels\((\w+)\)\{await this\.ensureReady\(\);let (\w+)=`model\/list:\$\{\(0,\w+\.randomUUID\)\(\)\}`,\w+=await this\.sendInternalRequest\(\{id:\2,method:`model\/list`,params:\1\}\);if\(\w+\.error\)throw Error\(\w+\.error\.message\?\?`Failed to read available models`\);return \w+\.result\}/;
const MAIN_LIST_MODELS_APPLIED = /__codexLinuxMergeCustomEndpointCatalogModels\(\w+,await this\.getUserSavedConfiguration\?\.\(\)\)\}catch\{\}return \w+\}async startThread/;

const MAIN_HELPER = String.raw`__codexLinuxMergeCustomEndpointCatalogModels=function(e,t){try{let n=t?.model_catalog_json,r=t?.model,i=require("node:fs");if(typeof n!="string"||!n){let e=require("node:path"),t=require("node:os"),a=e.join(process.env.CODEX_HOME||e.join(t.homedir(),".codex"),"config.toml"),o=i.readFileSync(a,"utf8");n=o.match(/^\s*model_catalog_json\s*=\s*"([^"]+)"/m)?.[1],r??=o.match(/^\s*model\s*=\s*"([^"]+)"/m)?.[1]}if(typeof n!="string"||!n)return e;let a=JSON.parse(i.readFileSync(n,"utf8")),o=Array.isArray(a)?a:Array.isArray(a?.models)?a.models:[],s=Array.isArray(e?.data)?e.data:Array.isArray(e?.models)?e.models:Array.isArray(e)?e:null;if(!s)return e;let c=new Set(s.map(e=>e?.model).filter(Boolean)),l=[];for(let e of o){let t=e?.slug??e?.model;if(typeof t!="string"||!t||c.has(t))continue;let n=e?.supported_reasoning_levels??e?.supportedReasoningEfforts??[],i=n.map(e=>({reasoningEffort:e?.effort??e?.reasoningEffort,description:e?.description??(e?.effort??e?.reasoningEffort)+" effort"})).filter(e=>typeof e.reasoningEffort=="string"),a=e?.default_reasoning_level??e?.defaultReasoningEffort??i[0]?.reasoningEffort??"medium";l.push({model:t,name:e?.display_name??e?.name??t,displayName:e?.display_name??e?.name??t,description:e?.description??"",hidden:e?.visibility==="hidden",isDefault:t===r,defaultReasoningEffort:a,supportedReasoningEfforts:i.length?i:[{reasoningEffort:a,description:a+" effort"}]})}return l.length?(Array.isArray(e?.data)?{...e,data:[...s,...l]}:Array.isArray(e?.models)?{...e,models:[...s,...l]}:[...s,...l]):e}catch{return e}}`;

function readCatalogModelsForWebview() {
  try {
    const configPath = path.join(process.env.CODEX_HOME || path.join(require("node:os").homedir(), ".codex"), "config.toml");
    const config = fs.readFileSync(configPath, "utf8");
    const catalogPath = config.match(/^\s*model_catalog_json\s*=\s*"([^"]+)"/m)?.[1];
    const selectedModel = config.match(/^\s*model\s*=\s*"([^"]+)"/m)?.[1];
    if (typeof catalogPath !== "string" || catalogPath.length === 0) {
      return [];
    }
    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
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

function applyModelPickerAllowlistPatch(source) {
  const webviewCatalogModels = readCatalogModelsForWebview();
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
        `${prefix}let ${PICKER_WEBVIEW_CATALOG_MARKER}=${modelsJson};${modelsVar}=[...${modelsVar},...${PICKER_WEBVIEW_CATALOG_MARKER}.filter(e=>!${modelsVar}.some(t=>t.model===e.model))];`,
    );
  }
  if (PICKER_CURRENT_APPLIED.test(source)) {
    return source;
  }
  if (PICKER_CURRENT_NEEDLE.test(source)) {
    return source.replace(PICKER_CURRENT_NEEDLE, "$1!1$2");
  }
  if (!PICKER_NEEDLE.test(source)) {
    if (/function \w+\(\{authMethod:\w+,availableModels:\w+,defaultModel:\w+,enabledReasoningEfforts:\w+,includeUltraReasoningEffort:\w+,models:\w+,useHiddenModels:\w+\}\)/.test(source)) {
      console.warn(
        "WARN: Could not find model picker allowlist guard — skipping custom-endpoint-model-picker allowlist patch",
      );
    }
    return source;
  }
  return source.replace(PICKER_NEEDLE, "$1!1$2");
}

function applyMainBundleCatalogModelsPatch(source) {
  if (!source.includes("model/list")) {
    return source;
  }
  if (!source.includes(MAIN_HELPER_MARKER)) {
    if (!source.includes(MAIN_CLASS_NEEDLE)) {
      console.warn(
        "WARN: Could not find app-server class — skipping custom-endpoint-model-picker catalog model patch",
      );
      return source;
    }
    source = source.replace(MAIN_CLASS_NEEDLE, `${MAIN_HELPER},${MAIN_CLASS_NEEDLE}`);
  }
  if (MAIN_LIST_MODELS_APPLIED.test(source)) {
    return source;
  }
  if (!MAIN_LIST_MODELS_NEEDLE.test(source)) {
    console.warn(
      "WARN: Could not find model/list bridge — skipping custom-endpoint-model-picker catalog model patch",
    );
    return source;
  }
  return source.replace(
    MAIN_LIST_MODELS_NEEDLE,
    (_match, paramsVar, idVar) =>
      `async listModels(${paramsVar}){await this.ensureReady();let ${idVar}=\`model/list:\${(0,o.randomUUID)()}\`,n=await this.sendInternalRequest({id:${idVar},method:\`model/list\`,params:${paramsVar}});if(n.error)throw Error(n.error.message??\`Failed to read available models\`);let r=n.result;try{r=__codexLinuxMergeCustomEndpointCatalogModels(r,await this.getUserSavedConfiguration?.())}catch{}return r}`,
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

// ponytail: old direct loader — kept for older upstream bundles that lack getCompatibleThreadSortKey.
const SIDEBAR_APPLIED_MARKER = /\.recentConversationSortKey,modelProviders:\[\],archived:!1,sourceKinds:\w+/;
const SIDEBAR_NEEDLE = /listRecentThreads\(\{cursor:e,limit:t(,useStateDbOnly:\w+(?:=!\d)?)?\}\)\{return this\.params\.requestClient\.sendRequest\(`thread\/list`,\{limit:t,cursor:e,sortKey:this\.recentConversationSortKey,modelProviders:null,archived:!1,sourceKinds:(\w+)(,useStateDbOnly:\w+)?\}\)\}/;

// ponytail: server contract says modelProviders/sourceKinds [] means all providers + interactive sources.
const ASYNC_FILTER_REPLACEMENT = `modelProviders:[],archived:!1,sourceKinds:[]`;
const ASYNC_APPLIED_MARKER = /getCompatibleThreadSortKey\([^)]*\),modelProviders:\[\],archived:!1,sourceKinds:\[\]/;
const ASYNC_FILTER_NEEDLE = /(getCompatibleThreadSortKey\([^)]*\),)modelProviders:null,archived:!1,sourceKinds:\w+(?=,useStateDbOnly:\w+)/;
const BLANK_THREAD_FILTER_NEEDLE = /let (\w+)=s\.data;if\((\w+)\)\{/;
const BLANK_THREAD_FILTER_APPLIED_MARKER = /s\.data\.filter\(\w+=>\w+\.name\?\.trim\(\)\)/;

function applySidebarProviderFilterPatch(source) {
  // Already patched — old direct loader path.
  if (SIDEBAR_APPLIED_MARKER.test(source)) {
    return source;
  }
  // Old direct loader (pre getCompatibleThreadSortKey).
  if (SIDEBAR_NEEDLE.test(source)) {
    return source.replace(
      SIDEBAR_NEEDLE,
      (_match, paramStateDbOnly = "", sourceKinds, payloadStateDbOnly = "") =>
        `listRecentThreads({cursor:e,limit:t${paramStateDbOnly}}){return this.params.requestClient.sendRequest(\`thread/list\`,{limit:t,cursor:e,sortKey:this.recentConversationSortKey,modelProviders:[],archived:!1,sourceKinds:${sourceKinds}${payloadStateDbOnly}})}`,
    );
  }
  // Async loader — include all providers, default to interactive sources, then drop blank-title rows.
  if (ASYNC_FILTER_NEEDLE.test(source)) {
    source = source.replace(ASYNC_FILTER_NEEDLE, `$1${ASYNC_FILTER_REPLACEMENT}`);
  }
  if (!BLANK_THREAD_FILTER_APPLIED_MARKER.test(source) && BLANK_THREAD_FILTER_NEEDLE.test(source)) {
    source = source.replace(BLANK_THREAD_FILTER_NEEDLE, (_match, dataVar, expandedVar) =>
      `let ${dataVar}=s.data.filter(e=>e.name?.trim());if(${expandedVar}){`,
    );
  }
  if (ASYNC_APPLIED_MARKER.test(source) || BLANK_THREAD_FILTER_APPLIED_MARKER.test(source)) {
    return source;
  }
  if (source.includes("listRecentThreads") && source.includes("modelProviders:null") && !source.includes("getCompatibleThreadSortKey")) {
    console.warn(
      "WARN: Could not find sidebar provider filter — skipping custom-endpoint-model-picker sidebar patch",
    );
  }
  return source;
}

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
      pattern: /^(?:models-and-reasoning-efforts|model-list-filter|app-initial~app-main~.*(?:home-ambient-suggestions-content|onboarding-page)).*\.js$/,
      missingDescription: "model picker bundle",
      skipDescription: "custom-endpoint-model-picker allowlist patch",
      apply: applyModelPickerAllowlistPatch,
    },
    {
      id: "sidebar-provider-filter",
      name: "custom-endpoint-model-picker-sidebar-filter",
      phase: "webview-asset",
      pattern: /^(?:app-server-manager-signals|thread-context-inputs|app-initial~app-main~.*(?:plugin-detail-page|new-thread-panel-page)).*\.js$/,
      missingDescription: "thread context inputs bundle",
      skipDescription: "custom-endpoint-model-picker sidebar provider filter patch",
      apply: applySidebarProviderFilterPatch,
    },
  ],
  applyExtractedAppCatalogModelsPatch,
  applyMainBundleCatalogModelsPatch,
  applyModelPickerAllowlistPatch,
  applySidebarProviderFilterPatch,
};
