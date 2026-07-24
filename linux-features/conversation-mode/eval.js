#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  applyComposerControlPatch,
  applyDictationEndpointPatch,
  descriptors,
} = require("./patch.js");

const dictation = descriptors.find(({ id }) => id === "dictation-endpoint");
const source =
  "function Lke({onTranscriptInsert:i,onTranscriptSend:a}){let h={current:null},g={current:null},y={current:[]},b={current:null};let P=async({action:t,handlers:r})=>{let a=`hello`;a.length>0&&(df.getInstance().dispatchMessage(`global-dictation-record-history-item`,{text:a}),t===`send`?r.onTranscriptSend(a):r.onTranscriptInsert(a))},F=async()=>{let e=b.current??`insert`,r=h.current,i=y.current;y.current=[],r&&(r.ondataavailable=null,r.onstop=null),h.current=null,A();await P({action:e,audio:i,handlers:{onTranscriptInsert:i,onTranscriptSend:a}})},L=e=>{b.current=e;let t=h.current;t.state!==`inactive`&&t.stop()};return{startDictation:async()=>{let e=await _Oe({channelCount:1});let t=new MediaRecorder(e);if(h.current=t,y.current=[],t.ondataavailable=e=>{e.data.size>0&&y.current.push(e.data)},t.onstop=()=>{F()},t.start(),u(!0),b.current!=null){t.stop();return}},stopDictation:L}}";

assert.ok(dictation.pattern.test("app-initial-C-fROkKo.js"));
assert.match(applyDictationEndpointPatch(source), /codexLinuxConversationEndpoint/);
const latestDictation =
  "function Mit(){let e=!1,t=null,n=()=>{e=!0,t?.getTracks().forEach(e=>{e.stop()}),t=null};return{dispose:n,stream:trt({channelCount:1}).then(r=>(t=r,e&&n(),r))}}function Lke({onTranscriptInsert:i,onTranscriptSend:a}){let h={current:null},g={current:null},y={current:[]},b={current:null},C={current:!1};let P=async({action:t,handlers:r})=>{let a=`hello`;a.length>0&&(df.getInstance().dispatchMessage(`global-dictation-record-history-item`,{text:a}),t===`send`?r.onTranscriptSend(a):r.onTranscriptInsert(a))},F=async()=>{let e=b.current??`insert`,r=h.current,i=y.current;if(y.current=[],r&&(r.ondataavailable=null,r.onstop=null),h.current=null,A(),D(),C.current&&(u(!1),M()),i.length===0)return;await P({action:e,audio:i,handlers:{onTranscriptInsert:i,onTranscriptSend:a}})},L=e=>{b.current=e;let t=h.current;t.state!==`inactive`&&t.stop()};return{startDictation:async()=>{let e=Mit();g.current=e;let t=await e.stream;g.current===e&&(g.current=null);let n=new MediaRecorder(t);if(h.current=n,y.current=[],n.ondataavailable=e=>{e.data.size>0&&y.current.push(e.data)},n.onstop=()=>{F()},n.start(),u(!0),b.current!=null){n.stop();return}},stopDictation:L}}";
assert.match(applyDictationEndpointPatch(latestDictation), /stream:trt\(\{channelCount:1,echoCancellation:!0/);
const latestComposer =
  "function INs(e){let t=(0,KNs.c)(206),{isResponseInProgress:D,onStop:M,submitBlockReason:N,voiceControls:L}=e,j=Nn(Bk),P=RZ(),Q=LEa(j.value,z),{canRetryDictation:B,dictationShortcutLabel:V,isDictating:U,isDictationButtonVisible:W,isDictationSupported:G,isTranscribing:ee,isVoiceFooterVisible:te,recordingDurationMs:ne,retryDictation:K,startDictation:re,stopDictation:ie,restrictedSession:ae,waveformCanvasRef:oe}=L;let ke=(0,z$.jsx)(Twe,{isTranscribing:ee,recordingDurationMs:ne,waveformCanvasRef:oe,stopDictation:ie}),Ae=(0,z$.jsx)(Ewe,{isVisible:W,disabled:!G||ae.thread.phase!==`inactive`,isTranscribing:ee,canRetryDictation:B,shortcutLabel:V,retryDictation:K,startDictation:re,stopDictation:ie});return Ae}function owner(){let x=(0,z$.jsx)(INs,{isResponseInProgress:Ie,onStop:ua,submitBlockReason:Ka,voiceControls:_o}),y=(0,z$.jsx)(cHs,{conversationId:ne,hostId:g,cwdOverride:_});return[x,y]}";
assert.match(applyComposerControlPatch(latestComposer), /codexLinuxConversationToggle/);
console.log("4/4 conversation-mode eval scenarios passed");
