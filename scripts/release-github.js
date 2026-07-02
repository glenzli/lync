#!/usr/bin/env node

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, [
    path.join(__dirname, 'release.js'),
    '--only',
    'github',
    ...process.argv.slice(2),
], {
    cwd: process.cwd(),
    stdio: 'inherit',
});

process.exit(result.status ?? 1);
