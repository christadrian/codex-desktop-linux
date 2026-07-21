"use strict";

// The webview hides official marketplaces based on auth method.
// When using custom endpoints, authMethod is non-standard →
// both `openai-curated` and `openai-curated-remote` are hidden.
//
// This patch disables the auth-method-based marketplace hiding
// and the statsig-gate-based hiding, leaving all marketplaces visible
// regardless of provider or auth method.

// Current shared plugin hook memoizes the auth-derived hide decision, then
// copies it into shouldHideOpenAICuratedMarketplaces. Force only that copy to
// false; the independent remote-marketplace feature gate remains unchanged.
const HIDE_NEEDLE =
  /([A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\(`4218407052`\),([A-Za-z_$][\w$]*)=[^;]*?authMethod\?\?null,[A-Za-z_$][\w$]*;[^;]*?\2[^;]*?;let )([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*|!1)(,)/;

function applyMarketplaceHidePatch(source) {
  const match = source.match(HIDE_NEEDLE);
  if (match != null) {
    return match[4] === "!1" ? source : source.replace(HIDE_NEEDLE, "$1$3=!1$5");
  }
  if (source.includes("4218407052") && source.includes("authMethod")) {
    console.warn("WARN: Could not find current marketplace hide flag — skipping custom-endpoint-marketplace patch");
  }
  return source;
}

module.exports = {
  descriptors: [
    {
      id: "marketplace-hide-guard",
      name: "custom-endpoint-marketplace-hide-guard",
      phase: "webview-asset",
      pattern:
        /^app-initial~artifact-tab-content\.electron~notebook-preview-panel~app-main~pull-request-rout~[^.]+\.js$/,
      missingDescription: "shared plugins hook bundle",
      skipDescription: "custom-endpoint-marketplace hide guard patch",
      apply: applyMarketplaceHidePatch,
    },
  ],
  applyMarketplaceHidePatch,
};
