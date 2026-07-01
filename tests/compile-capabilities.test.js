const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('yaml');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'packages', 'cli', 'dist', 'index.js');
const CONSOLE = path.join(ROOT, 'packages', 'console', 'dist', 'index.js');

let workspace;

function run(args) {
    return execFileSync(process.execPath, [CLI, ...args], {
        cwd: workspace,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    });
}

function runConsole(args) {
    return execFileSync(process.execPath, [CONSOLE, ...args], {
        cwd: workspace,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    });
}

function write(relPath, content) {
    const filePath = path.join(workspace, relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function read(relPath) {
    return fs.readFileSync(path.join(workspace, relPath), 'utf8');
}

function readReport() {
    return yaml.parse(read('.vasmc/build-report.yaml'));
}

function entryBySource(report, source) {
    const entry = report.entries.find(item => item.source === source);
    assert.ok(entry, `report entry ${source} must exist`);
    return entry;
}

function actionTypes(entry) {
    return (entry.actions || []).map(action => action.type);
}

before(() => {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' });

    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vasmc-compile-'));

    write('vasmc-build.yaml', [
        'includes:',
        '  - "src/*.vasm.md"',
        'excludes:',
        '  - "src/fragment.vasm.md"',
        'output:',
        '  dir: "./out"',
        'baseDir: "./src"',
        'compile:',
        '  informational:',
        '    targetLangs: ["en", "zh-CN"]',
        '  executable:',
        '    targetLangs: ["en", "zh-CN"]',
        '  integrative:',
        '    targetLangs: ["en"]',
        'security:',
        '  mode: review',
        'ai:',
        '  projectReview:',
        '    mode: suggest',
        '    include:',
        '      - "project-notes.md"',
        'routing:',
        '  - match: "src/integration.vasm.md"',
        '    dest: "./guides/integration.md"',
        ''
    ].join('\n'));

    write('project-notes.md', '# Project Notes\n\nUse workspace-specific terms.\n');
    write('.vasmc/build-instructions.md', '# legacy instructions\n');

    write('src/fragment.vasm.md', [
        '# Shared Fragment',
        '',
        'Shared fragment content.',
        ''
    ].join('\n'));

    write('src/docs.vasm.md', [
        '---',
        'vasm:',
        '  alias: capability-docs',
        '  compile:',
        '    format: informational',
        '---',
        '# Capability Docs',
        '',
        '<!-- lang:en -->',
        'English docs body.',
        '',
        '[Fragment](./fragment.vasm.md "@import:inline")',
        '<!-- /lang -->',
        '',
        '<!-- lang:zh-CN -->',
        '中文文档正文。',
        '',
        '[Fragment](./fragment.vasm.md "@import:inline")',
        '<!-- /lang -->',
        ''
    ].join('\n'));

    write('src/source-only-docs.vasm.md', [
        '---',
        'vasm:',
        '  alias: source-only-docs',
        '  compile:',
        '    format: informational',
        '---',
        '# Source Only Docs',
        '',
        '这是一份只维护中文源内容的说明文档。',
        ''
    ].join('\n'));

    write('src/skill.vasm.md', [
        '---',
        'vasm:',
        '  alias: capability-skill',
        '  intent: Verify that executable outputs produce AI follow-up actions.',
        '  compile:',
        '    format: executable',
        '---',
        '# Capability Skill',
        '',
        '<!-- lang:en -->',
        'Follow the English procedure with careful verification steps.',
        '<!-- /lang -->',
        '',
        '<!-- lang:zh-CN -->',
        '执行中文流程。',
        '<!-- /lang -->',
        ''
    ].join('\n'));

    write('src/integration.vasm.md', [
        '---',
        'vasm:',
        '  alias: capability-integration',
        '  intent: Guide composition without becoming final executable prompt content.',
        '  compile:',
        '    format: integrative',
        '---',
        '# Integration Guide',
        '',
        'Use this only as composition guidance.',
        ''
    ].join('\n'));
});

after(() => {
    if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
});

describe('Compilation capability matrix', () => {
    it('workspace build covers formats, routing, language outputs, and report actions', () => {
        run(['build']);

        assert.ok(!fs.existsSync(path.join(workspace, '.vasmc', 'build-instructions.md')), 'legacy build-instructions.md must be removed');

        const docs = read('out/docs.md');
        assert.ok(docs.includes('English docs body.'), 'informational output must include English block');
        assert.ok(docs.includes('中文文档正文。'), 'informational output must include Chinese block');
        assert.ok(docs.includes('Shared fragment content.'), 'informational output must inline shared fragment');

        assert.ok(fs.existsSync(path.join(workspace, 'out', 'skill.en.md')), 'AI executable build must write source-language variant');
        assert.ok(!fs.existsSync(path.join(workspace, 'out', 'skill.zh-CN.md')), 'AI executable build must not write untranslated target variant');
        assert.ok(fs.existsSync(path.join(workspace, 'guides', 'integration.md')), 'routing must place integrative output at configured destination');

        const report = readReport();
        assert.strictEqual(report.version, 2);
        assert.strictEqual(report.mode, 'ai-build');
        assert.ok(report.runId, 'workspace report must include runId');
        assert.strictEqual(report.reportPath, '.vasmc/build-report.yaml');
        assert.ok(report.projectReview, 'workspace report must include project review context');
        assert.ok((report.actions || []).some(action => action.type === 'project_review'), 'workspace report must include project_review action');

        const docsEntry = entryBySource(report, 'src/docs.vasm.md');
        assert.strictEqual(docsEntry.format, 'informational');
        assert.deepStrictEqual(docsEntry.compiledFiles, ['out/docs.md']);
        assert.deepStrictEqual(docsEntry.targetLangs, ['en', 'zh-CN']);

        const sourceOnlyDocsEntry = entryBySource(report, 'src/source-only-docs.vasm.md');
        assert.strictEqual(sourceOnlyDocsEntry.format, 'informational');
        assert.deepStrictEqual(sourceOnlyDocsEntry.compiledFiles, ['out/source-only-docs.md']);
        assert.ok(actionTypes(sourceOnlyDocsEntry).includes('translate'), 'source-only informational entry must request missing language translation');

        const sourceOnlyDocsTranslate = sourceOnlyDocsEntry.actions.find(action => action.type === 'translate');
        assert.deepStrictEqual(sourceOnlyDocsTranslate.targets, ['out/source-only-docs.md']);
        assert.ok(sourceOnlyDocsTranslate.notes.some(note => note.includes('en')), 'translate action must name the missing language');

        const skillEntry = entryBySource(report, 'src/skill.vasm.md');
        assert.strictEqual(skillEntry.format, 'executable');
        assert.deepStrictEqual(skillEntry.compiledFiles, ['out/skill.en.md']);
        assert.strictEqual(skillEntry.minimalTokenVariant.path, 'out/skill.en.md');
        assert.ok(actionTypes(skillEntry).includes('verify'), 'executable entry must request verify');
        assert.ok(actionTypes(skillEntry).includes('translate'), 'executable entry must request missing target translation');
        assert.ok(actionTypes(skillEntry).includes('tree_shake'), 'executable entry must include conditional tree_shake');

        const translate = skillEntry.actions.find(action => action.type === 'translate');
        assert.deepStrictEqual(translate.targets, ['out/skill.zh-CN.md']);

        const integrationEntry = entryBySource(report, 'src/integration.vasm.md');
        assert.strictEqual(integrationEntry.format, 'integrative');
        assert.strictEqual(integrationEntry.output, 'guides/integration.md');
        assert.deepStrictEqual(integrationEntry.compiledFiles, ['guides/integration.md']);
        assert.deepStrictEqual(actionTypes(integrationEntry), ['integration_review']);
    });

    it('single-entry AI build uses the same report flow as workspace build', () => {
        run(['build', 'src/skill.vasm.md', '-o', 'single-out']);

        assert.ok(fs.existsSync(path.join(workspace, 'single-out', 'skill.en.md')), 'single-entry build must write source-language variant');
        assert.ok(!fs.existsSync(path.join(workspace, 'single-out', 'skill.zh-CN.md')), 'single-entry build must leave missing translation to AI action');

        const report = readReport();
        assert.strictEqual(report.version, 2);
        assert.strictEqual(report.mode, 'ai-build');
        assert.strictEqual(report.entries.length, 1);
        assert.ok(report.projectReview, 'single-entry report must still include project review context');
        assert.ok((report.actions || []).some(action => action.type === 'project_review'), 'single-entry report must include project_review action');

        const entry = entryBySource(report, 'src/skill.vasm.md');
        assert.deepStrictEqual(entry.compiledFiles, ['single-out/skill.en.md']);
        assert.strictEqual(entry.minimalTokenVariant.path, 'single-out/skill.en.md');
        assert.ok(actionTypes(entry).includes('verify'), 'single-entry executable report must request verify');
        assert.ok(actionTypes(entry).includes('translate'), 'single-entry executable report must request translate');

        const translate = entry.actions.find(action => action.type === 'translate');
        assert.deepStrictEqual(translate.targets, ['single-out/skill.zh-CN.md']);
    });

    it('dry-run emits a report plan without writing outputs or the default report', () => {
        const beforeReport = read('.vasmc/build-report.yaml');
        const dryRunYaml = run(['build', 'src/skill.vasm.md', '-o', 'dry-run-out', '--dry-run', '--force']);
        const dryRunReport = yaml.parse(dryRunYaml);

        assert.strictEqual(dryRunReport.version, 2);
        assert.strictEqual(dryRunReport.dryRun, true);
        assert.strictEqual(dryRunReport.reportPath, '<stdout>');
        assert.ok(dryRunReport.runId, 'dry-run report must include runId');
        assert.ok(!fs.existsSync(path.join(workspace, 'dry-run-out')), 'dry-run must not write output files');
        assert.strictEqual(read('.vasmc/build-report.yaml'), beforeReport, 'dry-run must not update the default report');

        const entry = entryBySource(dryRunReport, 'src/skill.vasm.md');
        assert.strictEqual(entry.status, 'planned');
        assert.deepStrictEqual(entry.compiledFiles, ['dry-run-out/skill.en.md']);
        assert.ok(actionTypes(entry).includes('verify'), 'dry-run plan must include verify action');
        assert.ok(actionTypes(entry).includes('translate'), 'dry-run plan must include translate action');
    });

    it('dry-run can write an explicit report-out file without writing outputs', () => {
        const reportOut = path.join(workspace, '.vasmc', 'custom-plan.yaml');
        run(['build', 'src/skill.vasm.md', '-o', 'report-out-dry-run', '--dry-run', '--force', '--report-out', '.vasmc/custom-plan.yaml']);

        assert.ok(fs.existsSync(reportOut), 'explicit dry-run report must be written');
        assert.ok(!fs.existsSync(path.join(workspace, 'report-out-dry-run')), 'dry-run report-out must not write compiled outputs');
        const report = yaml.parse(fs.readFileSync(reportOut, 'utf8'));
        assert.strictEqual(report.dryRun, true);
        assert.strictEqual(report.reportPath, '.vasmc/custom-plan.yaml');
        assert.strictEqual(entryBySource(report, 'src/skill.vasm.md').status, 'planned');
    });

    it('--force rebuilds entries that would otherwise be skipped by build-state', () => {
        run(['build', 'src/skill.vasm.md', '-o', 'force-out']);
        assert.strictEqual(entryBySource(readReport(), 'src/skill.vasm.md').status, 'built');

        run(['build', 'src/skill.vasm.md', '-o', 'force-out']);
        assert.strictEqual(entryBySource(readReport(), 'src/skill.vasm.md').status, 'skipped');

        run(['build', 'src/skill.vasm.md', '-o', 'force-out', '--force']);
        assert.strictEqual(entryBySource(readReport(), 'src/skill.vasm.md').status, 'built');
    });

    it('expand stdout performs deterministic expansion without workspace routing or report writes', () => {
        const beforeReport = read('.vasmc/build-report.yaml');
        const expanded = run(['expand', 'src/docs.vasm.md', '--target-lang', 'zh-CN', '--stdout']);

        assert.ok(expanded.includes('中文文档正文。'), 'expand must keep requested language block');
        assert.ok(expanded.includes('Shared fragment content.'), 'expand must inline fragments');
        assert.ok(!expanded.includes('English docs body.'), 'expand must drop other language blocks');
        assert.strictEqual(read('.vasmc/build-report.yaml'), beforeReport, 'expand must not update build report');
    });

    it('deterministic single-entry profile compiles all configured language variants', () => {
        runConsole(['build', 'src/skill.vasm.md', '-o', 'deterministic-out']);

        const en = read('deterministic-out/skill.en.md');
        const zh = read('deterministic-out/skill.zh-CN.md');

        assert.ok(en.includes('Follow the English procedure'), 'English deterministic variant must keep English block');
        assert.ok(!en.includes('执行中文流程'), 'English deterministic variant must drop Chinese block');
        assert.ok(zh.includes('执行中文流程'), 'Chinese deterministic variant must keep Chinese block');
        assert.ok(!zh.includes('Follow the English procedure'), 'Chinese deterministic variant must drop English block');
    });
});
