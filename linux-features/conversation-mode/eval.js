#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyDictationEndpointPatch, descriptors } = require("./patch.js");

const dictation = descriptors.find(({ id }) => id === "dictation-endpoint");
const source =
  "function Lke({onTranscriptInsert:i,onTranscriptSend:a}){let h={current:null},g={current:null},y={current:[]},b={current:null};let P=async({action:t,handlers:r})=>{let a=`hello`;a.length>0&&(df.getInstance().dispatchMessage(`global-dictation-record-history-item`,{text:a}),t===`send`?r.onTranscriptSend(a):r.onTranscriptInsert(a))},F=async()=>{let e=b.current??`insert`,r=h.current,i=y.current;y.current=[],r&&(r.ondataavailable=null,r.onstop=null),h.current=null,A();await P({action:e,audio:i,handlers:{onTranscriptInsert:i,onTranscriptSend:a}})},L=e=>{b.current=e;let t=h.current;t.state!==`inactive`&&t.stop()};return{startDictation:async()=>{let e=await _Oe({channelCount:1});let t=new MediaRecorder(e);if(h.current=t,y.current=[],t.ondataavailable=e=>{e.data.size>0&&y.current.push(e.data)},t.onstop=()=>{F()},t.start(),u(!0),b.current!=null){t.stop();return}},stopDictation:L}}";

assert.ok(dictation.pattern.test("app-initial~app-main~onboarding-page-qmFVRsFx.js"));
assert.match(applyDictationEndpointPatch(source), /codexLinuxConversationEndpoint/);
console.log("2/2 conversation-mode eval scenarios passed");
