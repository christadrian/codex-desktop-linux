#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { applyRecordReplayMainBridgePatch, descriptors } = require("./patch.js");

const source = [
  'const cp=require("node:child_process"),fs=require("node:fs"),path=require("node:path");',
  'var bridge={"get-global-state":async({key:e})=>null};',
  "class Controller{",
  "status(){return this.pendingStatus??=this.request(`skysightStatus`).finally(()=>{this.pendingStatus=null}),this.pendingStatus}",
  "enable(){return this.desiredState=`running`,this.runSerialized(()=>this.withFailedEnableRollback(async()=>(await this.dependencies.archiveLegacyChronicleSkill(),this.request(`skysightStart`)))).catch(e=>{throw this.desiredState===`running`&&(this.desiredState=`stopped`),e})}",
  "disable(){let e=this.desiredState;return this.desiredState=`stopped`,this.runSerialized(()=>this.stopRecorder()).catch(t=>{throw this.desiredState===`stopped`&&(this.desiredState=e),t})}",
  "pause(){let e=this.desiredState;return this.desiredState=`paused`,this.runSerialized(()=>this.request(`skysightPause`)).catch(t=>{throw this.desiredState===`paused`&&(this.desiredState=e),t})}",
  "resume(){let e=this.desiredState;return this.desiredState=`running`,this.runSerialized(async()=>{let e=await this.status();return e.state===`stopped`?this.request(`skysightStart`):e.state===`running`?e:this.request(`skysightResume`)}).catch(t=>{throw this.desiredState===`running`&&(this.desiredState=e),t})}",
  "}",
].join("");
const patched = applyRecordReplayMainBridgePatch(source);

assert.equal(applyRecordReplayMainBridgePatch(patched), patched);
assert.match(patched, /codexLinuxChronicleSidecarControlStateAsync/);
assert.match(patched, /codexLinuxChronicleEnsureSidecarRunning\(!0\)/);
assert.match(patched, /\[`skysight`,`stop`\]/);
assert.match(patched, /\[`skysight`,`pause`\]/);
assert.equal(
  descriptors
    .find((descriptor) => descriptor.id === "record-replay-dictation-transcript")
    ?.pattern.test("app-initial-C-fROkKo.js"),
  true,
);
console.log("6/6 record-and-replay eval scenarios passed");
