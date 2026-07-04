#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-install-deps-eval-'));
const bin = path.join(tmp, 'bin');
fs.mkdirSync(bin);
const log = path.join(tmp, 'sudo.log');
const osRelease = path.join(tmp, 'os-release');
fs.writeFileSync(osRelease, 'ID=arch\nID_LIKE=arch\n');

function writeExe(name, body) {
  const file = path.join(bin, name);
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
}

writeExe('node', 'echo v24.16.0');
writeExe('npm', 'echo 11.16.0');
writeExe('npx', 'echo 11.16.0');
writeExe('pacman', 'exit 0');
writeExe('cargo', 'echo cargo 1.90.0');
writeExe('7zz', 'echo 7-Zip 26.00');
writeExe('sudo', `printf '%s\\n' "$*" >> '${log}'; exit 0`);

const result = spawnSync('bash', ['scripts/install-deps.sh'], {
  cwd: repo,
  env: {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    OS_RELEASE_FILE: osRelease,
    XDG_CURRENT_DESKTOP: 'Hyprland',
  },
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const sudoLog = fs.readFileSync(log, 'utf8');
assert.match(result.stdout, /Compatible Node\.js toolchain already available; skipping pacman nodejs\/npm packages/);
assert.doesNotMatch(sudoLog, /(^|\s)nodejs(\s|$)/, sudoLog);
assert.doesNotMatch(sudoLog, /(^|\s)npm(\s|$)/, sudoLog);
assert.match(sudoLog, /pacman -S --needed --noconfirm python p7zip curl unzip zstd base-devel/);
console.log('install-deps eval passed: pacman preserves existing compatible Node.js provider');
