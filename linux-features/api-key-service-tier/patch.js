"use strict";

const JS_IDENT = "[A-Za-z_$][\\w$]*";
const PATCH_MARKER = "codexLinuxApiKeyFastTier";
const MODEL_MARKER = "codexLinuxApiKeyServiceTierModel";

function warn(message, patchName) {
  console.warn(`WARN: ${message} - skipping ${patchName}`);
}

function applyApiKeyServiceTierGatePatch(source) {
  source = source.replace(
    /async function ([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\)\{let ([A-Za-z_$][\w$]*)=await ([A-Za-z_$][\w$]*)\(\2,\3\);return \4===`chatgpt`\?\(await ([A-Za-z_$][\w$]*)\.query\.fetch\(([A-Za-z_$][\w$]*),\{authMethod:\4,hostId:\3\}\)\)\.requirements\?\.featureRequirements\?\.fast_mode!==!1:!1\}/g,
    "async function $1($2,$3){let $4=await $5($2,$3);return $4===`apikey`?!0:$4===`chatgpt`?(await $6.query.fetch($7,{authMethod:$4,hostId:$3})).requirements?.featureRequirements?.fast_mode!==!1:!1}",
  );

  const gateNeedle = new RegExp(
    `(${JS_IDENT})=(${JS_IDENT})\\?\\.authMethod===\\\`chatgpt\\\`,` +
      `(${JS_IDENT})=\\2\\?\\.authMethod\\?\\?null([\\s\\S]{0,500}?),` +
      `d=\\1&&!(${JS_IDENT})&&(${JS_IDENT})!=null&&\\6\\?\\.requirements\\?\\.featureRequirements\\?\\.fast_mode!==!1`,
    "g",
  );

  const patched = source.replace(
    gateNeedle,
    (_match, isChatGptVar, hostVar, authMethodVar, middle, loadingVar, requirementsVar) =>
      `${isChatGptVar}=${hostVar}?.authMethod===\`chatgpt\`,` +
      `${authMethodVar}=${hostVar}?.authMethod??null${middle},` +
      `d=!${loadingVar}&&(${isChatGptVar}?${requirementsVar}!=null&&${requirementsVar}?.requirements?.featureRequirements?.fast_mode!==!1:${authMethodVar}===\`apikey\`)`,
  );

  if (
    patched !== source ||
    source.includes(`${authMethodVarName(source)}===\`apikey\``) ||
    /[A-Za-z_$][\w$]*=!+[A-Za-z_$][\w$]*&&\([A-Za-z_$][\w$]*\?[^;]+:[A-Za-z_$][\w$]*===`apikey`\)/.test(source) ||
    source.includes("===`apikey`?!0") ||
    source.includes(PATCH_MARKER)
  ) {
    return patched;
  }

  if (source.includes("featureRequirements?.fast_mode") && source.includes("authMethod===`chatgpt`")) {
    warn("Could not find service tier auth gate", "API key service tier gate patch");
  }
  return source;
}

function authMethodVarName(source) {
  return source.match(new RegExp(`(${JS_IDENT})=${JS_IDENT}\\?\\.authMethod\\?\\?null`))?.[1] ?? "__never";
}

function applyApiKeyModelMarkerPatch(source) {
  if (new RegExp(`${MODEL_MARKER}:${JS_IDENT}===\\\`apikey\\\``).test(source)) {
    return source;
  }

  const modelListPattern = new RegExp(
    `(function ${JS_IDENT}\\(\\{authMethod:(${JS_IDENT}),availableModels:${JS_IDENT},` +
      `defaultModel:${JS_IDENT},enabledReasoningEfforts:${JS_IDENT},` +
      `includeUltraReasoningEffort:${JS_IDENT},models:${JS_IDENT},useHiddenModels:${JS_IDENT}\\}\\)` +
      `\\{[\\s\\S]{0,1800}?[,;]${JS_IDENT}=\\{\\.\\.\\.${JS_IDENT},supportedReasoningEfforts:${JS_IDENT})(\\})`,
    "g",
  );

  const patched = source.replace(
    modelListPattern,
    (_match, prefix, authMethodVar, suffix) => `${prefix},${MODEL_MARKER}:${authMethodVar}===\`apikey\`${suffix}`,
  );

  if (patched !== source) {
    return patched;
  }

  if (/function [A-Za-z_$][\w$]*\(\{authMethod:[A-Za-z_$][\w$]*,availableModels:[A-Za-z_$][\w$]*,defaultModel:[A-Za-z_$][\w$]*,enabledReasoningEfforts:[A-Za-z_$][\w$]*,includeUltraReasoningEffort:[A-Za-z_$][\w$]*,models:[A-Za-z_$][\w$]*,useHiddenModels:[A-Za-z_$][\w$]*\}\)/.test(source)) {
    warn("Could not find model list mapping", "API key model service tier marker patch");
  }
  return source;
}

function applyFallbackFastTierPatch(source) {
  let patched = source;

  if (!patched.includes(`function ${PATCH_MARKER}(`)) {
    const fastResolverPattern = new RegExp(
      `function (${JS_IDENT})\\(e\\)\\{return e\\?\\.serviceTiers\\?\\.find\\(e=>` +
        `(${JS_IDENT})\\(e\\.id,e\\.name\\)===\\\`fast\\\`\\|\\|e\\.name\\.trim\\(\\)\\.toLowerCase\\(\\)===\\\`priority\\\`\\)\\?\\?null\\}`,
    );
    const fastResolverMatch = patched.match(fastResolverPattern);
    if (fastResolverMatch != null) {
      const helper =
        `function ${PATCH_MARKER}(e){return e==null||e?.serviceTiers?.length||e?.${MODEL_MARKER}!==!0?null:{id:\`fast\`,name:\`Fast\`,description:\`1.5x speed, increased usage\`}}`;
      patched = patched.replace(fastResolverPattern, `${helper}${fastResolverMatch[0]}`);
    }
  }

  const fastResolverPatch = new RegExp(
    `function (${JS_IDENT})\\(e\\)\\{return e\\?\\.serviceTiers\\?\\.find\\(e=>` +
      `(${JS_IDENT})\\(e\\.id,e\\.name\\)===\\\`fast\\\`\\|\\|e\\.name\\.trim\\(\\)\\.toLowerCase\\(\\)===\\\`priority\\\`\\)\\?\\?null\\}`,
    "g",
  );
  patched = patched.replace(
    fastResolverPatch,
    `function $1(e){return e?.serviceTiers?.find(e=>$2(e.id,e.name)===\`fast\`||e.name.trim().toLowerCase()===\`priority\`)??${PATCH_MARKER}(e)}`,
  );

  const optionsPatch = new RegExp(
    `\\.\\.\\.\\((${JS_IDENT})\\?\\.serviceTiers\\?\\?\\[\\]\\)\\.map\\((${JS_IDENT})=>\\(\\{` +
      `description:(${JS_IDENT})\\(\\2\\),iconKind:(${JS_IDENT})\\(\\2\\.id,\\2\\.name\\),` +
      `label:(${JS_IDENT})\\(\\2\\),tier:\\2,value:\\2\\.id\\}\\)\\)`,
    "g",
  );
  patched = patched.replace(
    optionsPatch,
    `...(($1?.serviceTiers?.length?$1.serviceTiers:[${PATCH_MARKER}($1)]).filter(Boolean)).map($2=>({description:$3($2),iconKind:$4($2.id,$2.name),label:$5($2),tier:$2,value:$2.id}))`,
  );

  if (patched !== source || source.includes(PATCH_MARKER)) {
    return patched;
  }

  if (source.includes("serviceTiers") && source.includes("defaultServiceTier")) {
    warn("Could not find service tier option helpers", "API key fallback fast tier patch");
  }
  return source;
}

function applyApiKeyServiceTierPatch(source) {
  return applyFallbackFastTierPatch(applyApiKeyModelMarkerPatch(applyApiKeyServiceTierGatePatch(source)));
}

const descriptors = [
  {
    id: "api-key-service-tier-ui",
    phase: "webview-asset",
    order: 20600,
    ciPolicy: "optional",
    pattern: /^app-initial~app-main~.*\.js$/,
    missingDescription: "app main webview bundle",
    skipDescription: "API key service tier UI patch",
    apply: applyApiKeyServiceTierPatch,
  },
];

module.exports = {
  applyApiKeyModelMarkerPatch,
  applyApiKeyServiceTierGatePatch,
  applyFallbackFastTierPatch,
  applyApiKeyServiceTierPatch,
  descriptors,
};
