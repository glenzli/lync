#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const root = path.resolve(__dirname, '..');
const suitePath = path.join(root, 'vasm', 'eval', 'vasmc-self-eval.yaml');
const reportPath = path.join(root, 'self-eval-reports', 'latest.md');

function fail(message) {
    console.error(`[SELF-EVAL:JUDGE] ${message}`);
    process.exit(1);
}

if (!fs.existsSync(suitePath)) {
    fail(`Missing suite file: ${path.relative(root, suitePath)}`);
}

if (!fs.existsSync(reportPath)) {
    fail(`Missing report file: ${path.relative(root, reportPath)}. Run npm run self-eval:hard-checks first.`);
}

const suite = yaml.parse(fs.readFileSync(suitePath, 'utf8'));
const report = fs.readFileSync(reportPath, 'utf8');
const match = /<!-- judge:start -->([\s\S]*?)<!-- judge:end -->/.exec(report);
if (!match) {
    fail('latest.md must contain <!-- judge:start --> and <!-- judge:end --> markers.');
}

const judgeBlock = match[1].trim();
if (!judgeBlock || judgeBlock.includes('状态：待执行') || judgeBlock.includes('待执行')) {
    fail('Judge block still looks unfilled.');
}

const missingCases = (suite.cases || [])
    .map(testCase => testCase.id)
    .filter(id => !judgeBlock.includes(id));
if (missingCases.length > 0) {
    fail(`Judge block is missing case ids: ${missingCases.join(', ')}`);
}

if (!/\b(pass|review|fail)\b/.test(judgeBlock)) {
    fail('Judge block must include machine-readable verdict words: pass, review, or fail.');
}

console.log('[SELF-EVAL:JUDGE] Judge report looks complete.');
