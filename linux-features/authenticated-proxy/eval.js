#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { applyAuthenticatedProxyPatch } = require("./patch.js");
const source = 'let c=require(`electron`);async function boot(){await c.app.whenReady()}class F{async performDesktopFetch(){let h=async e=>{let p=i==null?await c.net.fetch(a,{method:r,headers:n,body:m(),signal:o,credentials:s?`include`:`same-origin`,redirect:o}):await this.performProgressRequest({body:m(),headers:n,method:r,onUploadProgress:i,resolvedUrl:a,signal:o,useSessionCookies:s});return p};return h({})}performProgressRequest(){let u=c.net.request({method:n,url:i,headers:t,useSessionCookies:o}),d=-1,f=()=>{let e=u.getUploadProgress();!e.started||e.current===d||(d=e.current,r({loaded:e.current,total:e.total}))}}}';
const patched = applyAuthenticatedProxyPatch(source);
assert.match(patched, /!codexLinuxProxyAuthEntry/);
assert.match(patched, /codexLinuxAttachProxyAuthToRequest\(u\)/);
console.log("2/2 authenticated-proxy eval scenarios passed");
