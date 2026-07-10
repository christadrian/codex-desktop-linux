"use strict";

const {
  inferModuleAlias,
} = require("../../scripts/patches/lib/minified-js.js");

function applyAuthenticatedProxyPatch(currentSource) {
  const electronVar = inferModuleAlias(currentSource, "electron");
  if (electronVar == null) {
    console.warn(
      "WARN: Could not find Electron alias - skipping Linux proxy authentication patch",
    );
    return currentSource;
  }

  const appLoginHelper =
    "function codexLinuxProxyAuthHost(e){return String(e??``).trim().replace(/^\\[|\\]$/g,``).toLowerCase()}" +
    "function codexLinuxProxyAuthEntry(e=process.env){if(process.platform!==`linux`)return null;let t=codexLinuxProxyAuthHost(e.CODEX_LINUX_PROXY_AUTH_HOST),n=String(e.CODEX_LINUX_PROXY_AUTH_PORT??``).trim(),r=e.CODEX_LINUX_PROXY_USERNAME;if(!t||r==null||String(r).length===0)return null;return{host:t,port:n,username:String(r),password:String(e.CODEX_LINUX_PROXY_PASSWORD??``)}}" +
    "function codexLinuxInstallProxyAuthHandler(e){let t=codexLinuxProxyAuthEntry();if(t==null)return;e.app.on(`login`,(n,r,i,a,o)=>{if(!a?.isProxy)return;let s=codexLinuxProxyAuthHost(a.host),l=String(a.port??``).trim();if(t.host!==s||t.port&&l&&t.port!==l)return;n.preventDefault(),o(t.username,t.password)})}";
  const requestLoginHelper =
    "function codexLinuxAttachProxyAuthToRequest(e){let t=codexLinuxProxyAuthEntry();if(t==null||e==null)return;e.on(`login`,(n,r)=>{if(!n?.isProxy){r();return}let i=codexLinuxProxyAuthHost(n.host),a=String(n.port??``).trim();if(t.host!==i||t.port&&a&&t.port!==a){r();return}r(t.username,t.password)})}";
  const installHandlerNeedle = "function codexLinuxInstallProxyAuthHandler(";
  let patchedSource = currentSource;

  if (!patchedSource.includes(installHandlerNeedle)) {
    const whenReadyNeedle = `await ${electronVar}.app.whenReady()`;
    if (!patchedSource.includes(whenReadyNeedle)) {
      if (patchedSource.includes(".app.whenReady()")) {
        console.warn(
          "WARN: Could not find Electron app ready point - skipping Linux proxy authentication patch",
        );
      }
      return patchedSource;
    }

    const strictDirective = '"use strict";';
    const helperInsertionIndex = patchedSource.startsWith(strictDirective)
      ? strictDirective.length
      : 0;
    patchedSource =
      patchedSource.slice(0, helperInsertionIndex) +
      appLoginHelper +
      requestLoginHelper +
      patchedSource.slice(helperInsertionIndex);

    patchedSource = patchedSource.replace(
      whenReadyNeedle,
      `codexLinuxInstallProxyAuthHandler(${electronVar});${whenReadyNeedle}`,
    );
  } else if (!patchedSource.includes("function codexLinuxAttachProxyAuthToRequest(")) {
    const insertAfterAppLoginHelper =
      "function codexLinuxInstallProxyAuthHandler(e){let t=codexLinuxProxyAuthEntry();if(t==null)return;e.app.on(`login`,(n,r,i,a,o)=>{if(!a?.isProxy)return;let s=codexLinuxProxyAuthHost(a.host),l=String(a.port??``).trim();if(t.host!==s||t.port&&l&&t.port!==l)return;n.preventDefault(),o(t.username,t.password)})}";
    const legacyInlineHostAppLoginHelper =
      "function codexLinuxProxyAuthEntry(e=process.env){if(process.platform!==`linux`)return null;let t=String(e.CODEX_LINUX_PROXY_AUTH_HOST??``).trim().replace(/^\\[|\\]$/g,``).toLowerCase(),n=String(e.CODEX_LINUX_PROXY_AUTH_PORT??``).trim(),r=e.CODEX_LINUX_PROXY_USERNAME;if(!t||r==null||String(r).length===0)return null;return{host:t,port:n,username:String(r),password:String(e.CODEX_LINUX_PROXY_PASSWORD??``)}}function codexLinuxInstallProxyAuthHandler(e){let t=codexLinuxProxyAuthEntry();if(t==null)return;e.app.on(`login`,(n,r,i,a,o)=>{if(!a?.isProxy)return;let s=String(a.host??``).replace(/^\\[|\\]$/g,``).toLowerCase();if(t.host!==s||t.port&&String(a.port??``)!==t.port)return;n.preventDefault(),o(t.username,t.password)})}";
    if (patchedSource.includes(legacyInlineHostAppLoginHelper)) {
      patchedSource = patchedSource.replace(
        legacyInlineHostAppLoginHelper,
        appLoginHelper + requestLoginHelper,
      );
    } else if (patchedSource.includes(insertAfterAppLoginHelper)) {
      patchedSource = patchedSource.replace(
        insertAfterAppLoginHelper,
        insertAfterAppLoginHelper + requestLoginHelper,
      );
    } else {
      console.warn(
        "WARN: Could not extend existing Linux proxy authentication helper with ClientRequest support",
      );
    }
  }

  const fetchRegex = new RegExp(
    "let ([A-Za-z_$][\\w$]*)=([A-Za-z_$][\\w$]*)==null\\?await " +
      electronVar.replace(/[$]/g, "\\$&") +
      "\\.net\\.fetch\\(([A-Za-z_$][\\w$]*),\\{method:([A-Za-z_$][\\w$]*),headers:([A-Za-z_$][\\w$]*),body:([A-Za-z_$][\\w$]*)\\(\\),signal:([A-Za-z_$][\\w$]*),credentials:([A-Za-z_$][\\w$]*)\\?`include`:`same-origin`\\}\\):await this\\.performProgressRequest\\(\\{body:\\6\\(\\),headers:\\5,method:\\4,onUploadProgress:\\2,resolvedUrl:\\3,signal:\\7,useSessionCookies:\\8\\}\\);",
    "u",
  );
  const fetchMatch = patchedSource.match(fetchRegex);
  if (fetchMatch != null) {
    patchedSource = patchedSource.replace(
      fetchMatch[0],
      fetchMatch[0].replace(`${fetchMatch[2]}==null?`, `${fetchMatch[2]}==null&&!codexLinuxProxyAuthEntry()?`),
    );
  } else if (
    patchedSource.includes(
      "let f=i==null?await c.net.fetch(a,{method:r,headers:n,body:m(),signal:o,credentials:s?`include`:`same-origin`}):await this.performProgressRequest({body:m(),headers:n,method:r,onUploadProgress:i,resolvedUrl:a,signal:o,useSessionCookies:s});",
    )
  ) {
    patchedSource = patchedSource.replace(
      "let f=i==null?await c.net.fetch(a,{method:r,headers:n,body:m(),signal:o,credentials:s?`include`:`same-origin`}):await this.performProgressRequest({body:m(),headers:n,method:r,onUploadProgress:i,resolvedUrl:a,signal:o,useSessionCookies:s});",
      "let f=i==null&&!codexLinuxProxyAuthEntry()?await c.net.fetch(a,{method:r,headers:n,body:m(),signal:o,credentials:s?`include`:`same-origin`}):await this.performProgressRequest({body:m(),headers:n,method:r,onUploadProgress:i,resolvedUrl:a,signal:o,useSessionCookies:s});",
    );
  } else if (
    patchedSource.includes("performDesktopFetch") &&
    !patchedSource.includes("!codexLinuxProxyAuthEntry()?await") &&
    patchedSource.includes("net.fetch")
  ) {
    console.warn(
      "WARN: Could not route Linux proxy-auth desktop fetches through ClientRequest",
    );
  }

  const requestRegex = new RegExp(
    `let ([A-Za-z_$][\\w$]*)=${electronVar.replace(/[$]/g, "\\$&")}\\.net\\.request\\(\\{method:([A-Za-z_$][\\w$]*),url:([A-Za-z_$][\\w$]*),headers:([A-Za-z_$][\\w$]*),useSessionCookies:([A-Za-z_$][\\w$]*)\\}\\),([A-Za-z_$][\\w$]*)=-1,([A-Za-z_$][\\w$]*)=\\(\\)=>\\{let ([A-Za-z_$][\\w$]*)=\\1\\.getUploadProgress\\(\\);!\\8\\.started\\|\\|\\8\\.current===\\6\\|\\|\\(\\6=\\8\\.current,([A-Za-z_$][\\w$]*)\\(\\{loaded:\\8\\.current,total:\\8\\.total\\}\\)\\)\\}`,
    "u",
  );
  const requestMatch = patchedSource.match(requestRegex);
  if (requestMatch != null) {
    const [needle, requestVar, , , , , progressVar, pollVar, uploadVar, callbackVar] = requestMatch;
    patchedSource = patchedSource.replace(
      needle,
      needle
        .replace(`),${progressVar}=-1`, `);codexLinuxAttachProxyAuthToRequest(${requestVar});let ${progressVar}=-1`)
        .replace(`${pollVar}=()=>{let`, `${pollVar}=()=>{if(${callbackVar}==null)return;let`),
    );
  } else if (
    patchedSource.includes(
      "let u=c.net.request({method:n,url:i,headers:t,useSessionCookies:o}),d=-1,f=()=>{let e=u.getUploadProgress();!e.started||e.current===d||(d=e.current,r({loaded:e.current,total:e.total}))}",
    )
  ) {
    patchedSource = patchedSource.replace(
      "let u=c.net.request({method:n,url:i,headers:t,useSessionCookies:o}),d=-1,f=()=>{let e=u.getUploadProgress();!e.started||e.current===d||(d=e.current,r({loaded:e.current,total:e.total}))}",
      "let u=c.net.request({method:n,url:i,headers:t,useSessionCookies:o});codexLinuxAttachProxyAuthToRequest(u);let d=-1,f=()=>{if(r==null)return;let e=u.getUploadProgress();!e.started||e.current===d||(d=e.current,r({loaded:e.current,total:e.total}))}",
    );
  } else if (
    patchedSource.includes("performProgressRequest") &&
    !patchedSource.includes("codexLinuxAttachProxyAuthToRequest(") &&
    patchedSource.includes("net.request")
  ) {
    console.warn(
      "WARN: Could not attach Linux proxy authentication to ClientRequest fetch path",
    );
  }

  return patchedSource;
}

const descriptors = [
  {
    id: "main-process-proxy-auth",
    phase: "main-bundle",
    order: 125,
    ciPolicy: "optional",
    apply: applyAuthenticatedProxyPatch,
  },
];

module.exports = {
  applyAuthenticatedProxyPatch,
  descriptors,
};
