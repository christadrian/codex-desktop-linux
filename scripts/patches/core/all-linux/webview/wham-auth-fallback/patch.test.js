"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { applyLinuxWhamAuthFallbackPatch } = require("./patch.js");

test("already patched WHAM fallbacks do not warn", () => {
  const source = "async function u(){try{return await a.safeGet(`/wham/usage`)}catch(e){if(e?.status===401||String(e?.message??e).includes(`Unauthorized`))return null;throw e}}";
  const warnings = [];
  const oldWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    assert.equal(applyLinuxWhamAuthFallbackPatch(source), source);
  } finally {
    console.warn = oldWarn;
  }
  assert.deepEqual(warnings, []);
});
