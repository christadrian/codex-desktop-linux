"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { EXPECTED_PATCHES, evaluateReport } = require("./eval-current-feature-patches.js");

test("feature patch drift eval requires every current upstream patch", () => {
  const report = { patches: EXPECTED_PATCHES.map((name) => ({ name, status: "applied" })) };
  report.patches[0].status = "applied-with-warnings";
  const score = evaluateReport(report);
  assert.equal(score.passed, EXPECTED_PATCHES.length - 1);
  assert.deepEqual(score.results[0], {
    name: EXPECTED_PATCHES[0],
    status: "applied-with-warnings",
    passed: false,
  });
});

test("feature patch drift eval accepts applied and already-applied entries", () => {
  const report = {
    patches: EXPECTED_PATCHES.map((name, index) => ({
      name,
      status: index % 2 === 0 ? "applied" : "already-applied",
    })),
  };
  assert.equal(evaluateReport(report).passed, EXPECTED_PATCHES.length);
});
