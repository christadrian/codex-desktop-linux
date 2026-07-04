"use strict";

function authFallbackGuard(errorVar) {
  return `(${errorVar}?.status===401||${errorVar}?.status===403||${errorVar}?.status===404||String(${errorVar}?.message??${errorVar}).includes(\`Unauthorized\`))`;
}

function safeGetFallback(endpoint, fallback) {
  const escapedEndpoint = endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    pattern: new RegExp(`function ([A-Za-z_$][\\w$]*)\\(([^)]*)\\)\\{return ([A-Za-z_$][\\w$]*)\\.safeGet\\(\\\`${escapedEndpoint}\\\`([^)]*)\\)\\}`, "g"),
    replace: (_match, fn, args, api, tail) =>
      `async function ${fn}(${args}){try{return await ${api}.safeGet(\`${endpoint}\`${tail})}catch(e){if${authFallbackGuard("e")}return ${fallback};throw e}}`,
  };
}

function applyLinuxWhamAuthFallbackPatch(source) {
  let patched = source;

  for (const { pattern, replace } of [
    safeGetFallback("/wham/settings/user", "null"),
    safeGetFallback("/wham/settings/configs/user-preferences", "null"),
    safeGetFallback("/wham/environments/search", "{items:[],cursor:null}"),
    safeGetFallback("/wham/machines", "[]"),
  ]) {
    patched = patched.replace(pattern, replace);
  }

  patched = patched.replace(
    /function ([A-Za-z_$][\w$]*)\(\)\{return ([A-Za-z_$][\w$]*)\.safeGet\(`\/wham\/usage\/daily-token-usage-breakdown`\)\}/g,
    (_match, fn, api) =>
      `async function ${fn}(){try{return await ${api}.safeGet(\`/wham/usage/daily-token-usage-breakdown\`)}catch(e){if${authFallbackGuard("e")}return{data:[],units:null};throw e}}`,
  );

  patched = patched.replace(
    /function ([A-Za-z_$][\w$]*)\(\)\{return ([A-Za-z_$][\w$]*)\.safeGet\(`\/wham\/usage\/credit-usage-events`\)\}/g,
    (_match, fn, api) =>
      `async function ${fn}(){try{return await ${api}.safeGet(\`/wham/usage/credit-usage-events\`)}catch(e){if${authFallbackGuard("e")}return{data:[]};throw e}}`,
  );

  patched = patched.replace(
    /async\(\)=>\(await ([A-Za-z_$][\w$]*)\.safeGet\(`\/wham\/tasks\/list`,\{parameters:\{query:\{limit:([A-Za-z_$][\w$]*)\?\.limit,task_filter:\2\?\.taskFilter\}\}\}\)\)\.items/g,
    (_match, api, optionsVar) =>
      `async()=>{try{return(await ${api}.safeGet(\`/wham/tasks/list\`,{parameters:{query:{limit:${optionsVar}?.limit,task_filter:${optionsVar}?.taskFilter}}})).items}catch(e){if${authFallbackGuard("e")}return[];throw e}}`,
  );

  patched = patched.replace(
    /catch\(([A-Za-z_$][\w$]*)\)\{if\(\1 instanceof ([A-Za-z_$][\w$]*)&&\(\1\.status===401\|\|\1\.status===403\|\|\1\.status===404\)\)return\s*(\{items:\[\],cursor:null\}|\[\]|null);throw \1\}/g,
    (_match, errorVar, errorClass, fallback) =>
      `catch(${errorVar}){if(${errorVar} instanceof ${errorClass}&&(${errorVar}.status===401||${errorVar}.status===403||${errorVar}.status===404)||${authFallbackGuard(errorVar)})return ${fallback};throw ${errorVar}}`,
  );

  patched = patched.replace(
    /queryFn:async\(\)=>\{try\{return await ([A-Za-z_$][\w$]*)\.safeGet\(`\/wham\/usage`\)\}catch\(([A-Za-z_$][\w$]*)\)\{if\(\2 instanceof ([A-Za-z_$][\w$]*)&&\(\2\.status===401\|\|\2\.status===403\|\|\2\.status===404\)\)return null;throw \2\}\}/g,
    (_match, api, errorVar, errorClass) =>
      `queryFn:async()=>{try{return await ${api}.safeGet(\`/wham/usage\`)}catch(${errorVar}){if(${errorVar} instanceof ${errorClass}&&(${errorVar}.status===401||${errorVar}.status===403||${errorVar}.status===404)||${authFallbackGuard(errorVar)})return null;throw ${errorVar}}}`,
  );

  const fallbackRelevant = /\/wham\/(?:usage(?:\/daily-token-usage-breakdown|\/credit-usage-events)?|tasks\/list|settings\/(?:user|configs\/user-preferences)|environments\/search|machines)/.test(source);
  const alreadyHasFallback = source.includes("Unauthorized") && /return\s*(?:\{data:\[\](?:,units:null)?\}|\[\]|null|\{items:\[\],cursor:null\})/.test(source);
  if (patched === source && fallbackRelevant && !alreadyHasFallback) {
    console.warn("WARN: Could not add WHAM auth fallback for settings queries");
  }
  return patched;
}

module.exports = [
  {
    id: "linux-wham-settings-auth-fallback",
    phase: "webview-asset",
    order: 1047,
    ciPolicy: "optional",
    pattern: /^(?:usage-settings-.*|cloud-preferences-.*|cloud-environments-settings-page-.*|thread-context-inputs-.*|sidebar-project-group-signals-.*|data-controls-.*|app-initial~app-main~.*)\.js$/,
    missingDescription: "WHAM settings query bundle",
    skipDescription: "Linux WHAM settings auth fallback patch",
    apply: applyLinuxWhamAuthFallbackPatch,
  },
];

module.exports.applyLinuxWhamAuthFallbackPatch = applyLinuxWhamAuthFallbackPatch;
