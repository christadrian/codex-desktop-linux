"use strict";

// The webview hides official marketplaces based on auth method.
// When using custom endpoints, authMethod is non-standard →
// both `openai-curated` and `openai-curated-remote` are hidden.
//
// This patch disables the auth-method-based marketplace hiding
// and the statsig-gate-based hiding, leaving all marketplaces visible
// regardless of provider or auth method.

// Needle in use-plugins-*.js:
//   p=re(`4218407052`),m=pe(ae(e)?.authMethod??null),h=ve;m?h=xe:p&&(h=be);let g=Ae(...
// After patching:
//   p=re(`4218407052`),m=pe(ae(e)?.authMethod??null),h=ve;0;let g=Ae(...
//
// The `h=ve` (empty array = hide nothing) stays, and `0` replaces the
// conditional that would reassign h to hide marketplaces.

const HIDE_NEEDLE = /(p=re\(`4218407052`\),m=pe\(ae\(\w+\)\?\x2eauthMethod\x3f\x3fnull\),h=\w+);m\x3fh=\w+:p&&\(h=\w+\)/;
const CURRENT_HIDE_NEEDLE =
  /(([A-Za-z_$][\w$]*)=[A-Za-z_$][\w$]*\(`4218407052`\),([A-Za-z_$][\w$]*)=[^;]*?authMethod\?\?null\),([A-Za-z_$][\w$]*)=[A-Za-z_$][\w$]*);\3\?\4=[A-Za-z_$][\w$]*:\2&&\(\4=[A-Za-z_$][\w$]*\)/;
const LATEST_HIDE_NEEDLE =
  /([A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\(`4218407052`\),([A-Za-z_$][\w$]*)=[^;]*?authMethod\?\?null,[A-Za-z_$][\w$]*;[^;]*?\2[^;]*?;let )([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)(,)/;

const ALREADY_PATCHED = /h=\w+;0;let g=Ae\(/;
const CURRENT_ALREADY_PATCHED = /[A-Za-z_$][\w$]*=[^;]*?authMethod\?\?null\),[A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*;0;let [A-Za-z_$][\w$]*=/;

function applyMarketplaceHidePatch(source) {
  if (LATEST_HIDE_NEEDLE.test(source)) {
    return source.replace(LATEST_HIDE_NEEDLE, "$1$3=!1$5");
  }
  if (CURRENT_HIDE_NEEDLE.test(source)) {
    return source.replace(CURRENT_HIDE_NEEDLE, "$1;0");
  }
  if (HIDE_NEEDLE.test(source)) {
    return source.replace(HIDE_NEEDLE, "$1;0");
  }
  if (ALREADY_PATCHED.test(source) || CURRENT_ALREADY_PATCHED.test(source)) {
    return source;
  }
  return source;
}

module.exports = {
  descriptors: [
    {
      id: "marketplace-hide-guard",
      name: "custom-endpoint-marketplace-hide-guard",
      phase: "webview-asset",
      pattern: /^(?:use-plugins|plugin-detail-page|app-initial~app-main~).*\.js$/,
      missingDescription: "use-plugins bundle",
      skipDescription: "custom-endpoint-marketplace hide guard patch",
      apply: applyMarketplaceHidePatch,
    },
  ],
  applyMarketplaceHidePatch,
};
