#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codex-bootstrap-wizard-eval-"));

try {
  const featuresRoot = path.join(workspace, "linux-features");
  const configPath = path.join(workspace, "features.json");
  const home = path.join(workspace, "home");
  const manifests = [
    {
      id: "directory-only-working-tree-watch",
      title: "Directory-only working tree watch",
      conflicts: ["shallow-repository-watches"],
    },
    {
      id: "shallow-repository-watches",
      title: "Shallow repository watches",
      conflicts: ["directory-only-working-tree-watch"],
    },
  ];

  for (const manifest of manifests) {
    const featureDir = path.join(featuresRoot, manifest.id);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, "feature.json"), `${JSON.stringify(manifest)}\n`);
    fs.writeFileSync(path.join(featureDir, "README.md"), `# ${manifest.title}\n`);
  }
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(
    configPath,
    `${JSON.stringify({ enabled: ["directory-only-working-tree-watch"] })}\n`,
  );

  const result = spawnSync("bash", [path.join(repoRoot, "scripts/bootstrap-wizard.sh")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, ".config"),
      XDG_DATA_HOME: path.join(home, ".local/share"),
      XDG_STATE_HOME: path.join(home, ".local/state"),
      CODEX_BOOTSTRAP_NONINTERACTIVE: "1",
      CODEX_LINUX_FEATURES_ROOT: featuresRoot,
      CODEX_LINUX_FEATURES_CONFIG: configPath,
      CODEX_LINUX_FEATURES: "shallow-repository-watches",
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")).enabled, [
    "shallow-repository-watches",
  ]);
  assert.match(
    result.stdout,
    /Disabled conflicting Linux feature: directory-only-working-tree-watch/,
  );
  console.log("1/1 bootstrap-wizard eval scenarios passed");
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
