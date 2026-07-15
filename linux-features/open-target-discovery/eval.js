#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyOpenInTargetsDirectoryModePatch, descriptors } = require("./patch.js");
const descriptor = descriptors.find(({ id }) => id === "webview-native-open-target-selection");
assert(
  descriptor.pattern.test(
    "app-initial~app-main~new-thread-panel-page~onboarding-page~appgen-library-page~hotkey-windo~nrw3o0ql-current.js",
  ),
);
const source = '"open-in-targets":async({cwd:e,deferEnrichment:t=!1,hostId:r,nativeBrowserDiscovery:i=`scan`,path:a})=>{let o=this.getRequestAppServerClient(r??void 0),s=this.getSettingsStore();if(t&&a==null){let t=XN(s,e);return{preferredTarget:t,availableTargets:[],mode:`editor`,targets:uj(HN(s),o.hostConfig)}}let{allAvailableTargets:c,targetMetadata:l}=await WN(s,this.getOpenInWorker()),u=a?.replace(/^([ab])[\\\\/]/,``)??null,d=u!=null&&xF(u)&&!n.eo(o.hostConfig),f=u==null||d||n.eo(o.hostConfig)?null:this.resolveOpenFilePath(u,e),p=lj(o.hostConfig,c,l),m=new Set(p),h=YN(s,e,m),g=d||f!=null&&n.ys(f),_=f!=null&&KA(f),v=f!=null&&JA(f),y=g?await yF(i):_?await vF({filePath:f}):[];return{preferredTarget:h,availableTargets:Array.from(m),mode:g||v?`native`:`editor`,targets:l}}';
const patched = applyOpenInTargetsDirectoryModePatch(source);
assert.match(patched, /codexLinuxOpenTargetIsDirectory/);
assert.match(patched, /g=d\|\|_codexLinuxDirectory\|\|/);
console.log("3/3 open-target-discovery eval scenarios passed");
