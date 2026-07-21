#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applySharedAppServerSocketPatch } = require("./patch.js");

const source = [
  "var Ky=class{options;kind=`websocket`;logger=r.i(`AppServerTransportSshWebsocket`);proxyStreams=new Set;supportsReconnect(){return!0}",
  "async connect(){let t={current:null},r=new n.zn(Fy,{perMessageDeflate:!1,createConnection:()=>",
  "(t.current=this.createSshProxyStream(),t.current)});return n.Ln(r,{onPongTimeout:()=>r.terminate()}),new n.Rn(r)}};",
  "function n6(e){let t=Jy(e.hostConfig);if(t)return Z.info(`selected app-server transport`),new Ky(t);",
  "if(e.transportKind===`remote-control`)return new Remote(e);",
  "if(n.io(e.hostConfig))return new Wsl({hostConfig:e.hostConfig,repoRoot:e.repoRoot,resourcesPath:e.resourcesPath,defaultOriginator:e.defaultOriginator});",
  "let r=r6(e.hostConfig);if(r){e.desktopAuthAppServerClient;let t=p8(e.hostConfig,r);return new n.Fn({hostConfig:e.hostConfig,websocketUrl:r,getWebsocketProtocols:void 0,...t==null?{}:{socksProxyUrl:t}})}",
  "return new n.Nn({hostConfig:e.hostConfig,repoRoot:e.repoRoot,resourcesPath:e.resourcesPath,defaultOriginator:e.defaultOriginator})}function afterFactory(){}",
].join("");

const patched = applySharedAppServerSocketPatch(source);
assert.notEqual(patched, source);
assert.equal(applySharedAppServerSocketPatch(patched), patched);
assert.match(patched, /CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET/);
assert.match(
  patched,
  /new CodexLinuxSharedAppServerSocketTransport\(process\.env\.CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET\)/,
);
assert.match(patched, /app-server`,`proxy`,`--sock`/);
console.log("3/3 shared-app-server-socket eval scenarios passed");
