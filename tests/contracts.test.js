const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'index.js');
const FIXTURES = path.join(__dirname, 'fixtures', 'contract');

function run(args, cwd = FIXTURES) {
    return execSync(`node ${CLI} ${args}`, { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
}

// ─── Setup ──────────────────────────────────────────────────────────

before(() => {
    // Ensure dist is built
    execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });

    // Create fixture workspace
    fs.mkdirSync(FIXTURES, { recursive: true });
    fs.mkdirSync(path.join(FIXTURES, '.vasmc'), { recursive: true });

    // Dependency file for import tests
    fs.writeFileSync(path.join(FIXTURES, '.vasmc', 'greeter.md'), '# Greeter Module\n\nHello from greeter!\n', 'utf8');

    // vasmc.yaml declaring the dependency
    fs.writeFileSync(path.join(FIXTURES, 'vasmc.yaml'), 'dependencies:\n  greeter: "https://example.com/greeter.md"\n', 'utf8');

    // Lockfile
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update('# Greeter Module\n\nHello from greeter!\n').digest('hex');
    fs.writeFileSync(path.join(FIXTURES, 'vasmc-lock.yaml'),
        `version: 1\ndependencies:\n  greeter:\n    url: "https://example.com/greeter.md"\n    hash: "${hash}"\n    fetchedAt: "2026-01-01T00:00:00.000Z"\n`, 'utf8');

    // --- Fixture: @import:link ---
    fs.writeFileSync(path.join(FIXTURES, 'link-test.vasm.md'),
        '# Link Test\n\n[Greeter](vasm:greeter "@import:link")\n', 'utf8');

    // --- Fixture: @import:inline ---
    fs.writeFileSync(path.join(FIXTURES, 'inline-test.vasm.md'),
        '# Inline Test\n\n[Greeter](vasm:greeter "@import:inline")\n', 'utf8');

    // --- Fixture: Language blocks ---
    fs.writeFileSync(path.join(FIXTURES, 'lang-test.vasm.md'),
        [
            '---',
            'vasm:',
            '  alias: lang-test',
            '  compile:',
            '    format: executable',
            '---',
            '# Language Block Test',
            '',
            '<!-- lang:en -->',
            'This is English content.',
            '<!-- /lang -->',
            '',
            '<!-- lang:zh-CN -->',
            '这是中文内容。',
            '<!-- /lang -->',
            ''
        ].join('\n'), 'utf8');

    // --- Fixture: Workspace batch build ---
    fs.mkdirSync(path.join(FIXTURES, 'ws-src'), { recursive: true });
    fs.writeFileSync(path.join(FIXTURES, 'ws-src', 'a.vasm.md'), '# File A\n\nContent A\n', 'utf8');
    fs.writeFileSync(path.join(FIXTURES, 'ws-src', 'b.vasm.md'), '# File B\n\nContent B\n', 'utf8');
    fs.writeFileSync(path.join(FIXTURES, 'ws-build.yaml'),
        'includes:\n  - "ws-src/*.vasm.md"\noutput:\n  dir: "./ws-out"\nbaseDir: "./ws-src"\n', 'utf8');

    // --- Fixture: Seal ---
    fs.writeFileSync(path.join(FIXTURES, 'raw-prompt.md'), '# My Raw Prompt\n\nDo something useful.\n', 'utf8');
});

after(() => {
    fs.rmSync(FIXTURES, { recursive: true, force: true });
});

// ─── Contract 1: @import:link ─────────────────────────────────────

describe('Contract: @import:link rewrites alias to relative path', () => {
    it('output contains relative path and no vasm:alias', async () => {
        const outDir = path.join(FIXTURES, 'out-link');
        run(`build link-test.vasm.md -o ${outDir}`);
        const output = fs.readFileSync(path.join(outDir, 'link-test.md'), 'utf8');
        assert.ok(!output.includes('vasm:greeter'), 'Must not contain vasm:greeter alias');
        assert.ok(output.includes('.vasmc/greeter.md'), 'Must contain relative path to .vasmc/greeter.md');
        fs.rmSync(outDir, { recursive: true, force: true });
    });
});

// ─── Contract 2: @import:inline ───────────────────────────────────

describe('Contract: @import:inline expands content in-place', () => {
    it('output contains inlined content and no vasm:alias', async () => {
        const outDir = path.join(FIXTURES, 'out-inline');
        run(`build inline-test.vasm.md -o ${outDir}`);
        const output = fs.readFileSync(path.join(outDir, 'inline-test.md'), 'utf8');
        assert.ok(!output.includes('vasm:greeter'), 'Must not contain vasm:greeter alias');
        assert.ok(output.includes('Hello from greeter!'), 'Must contain inlined content');
        fs.rmSync(outDir, { recursive: true, force: true });
    });
});

// ─── Contract 3: Language block filtering ─────────────────────────

describe('Contract: Cross-compilation filters language blocks', () => {
    it('--target-langs en keeps only English', async () => {
        const outDir = path.join(FIXTURES, 'out-lang-en');
        run(`build lang-test.vasm.md --target-langs en -o ${outDir}`);
        const output = fs.readFileSync(path.join(outDir, 'lang-test.md'), 'utf8');
        assert.ok(output.includes('English content'), 'Must contain English content');
        assert.ok(!output.includes('中文内容'), 'Must not contain Chinese content');
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('--target-langs zh-CN keeps only Chinese', async () => {
        const outDir = path.join(FIXTURES, 'out-lang-zh');
        run(`build lang-test.vasm.md --target-langs zh-CN -o ${outDir}`);
        const output = fs.readFileSync(path.join(outDir, 'lang-test.md'), 'utf8');
        assert.ok(output.includes('中文内容'), 'Must contain Chinese content');
        assert.ok(!output.includes('English content'), 'Must not contain English content');
        fs.rmSync(outDir, { recursive: true, force: true });
    });
});

// ─── Contract 4: Workspace batch build ────────────────────────────

describe('Contract: Workspace build compiles all matched files', () => {
    it('produces output files for each source', async () => {
        // Use a custom build config via symlink trick: rename during test
        const buildYaml = path.join(FIXTURES, 'vasmc-build.yaml');
        const origBuildYaml = path.join(FIXTURES, 'ws-build.yaml');
        fs.copyFileSync(origBuildYaml, buildYaml);

        try {
            run('build');
            const outDir = path.join(FIXTURES, 'ws-out');
            assert.ok(fs.existsSync(path.join(outDir, 'a.md')), 'a.md must exist');
            assert.ok(fs.existsSync(path.join(outDir, 'b.md')), 'b.md must exist');

            const a = fs.readFileSync(path.join(outDir, 'a.md'), 'utf8');
            const b = fs.readFileSync(path.join(outDir, 'b.md'), 'utf8');
            assert.ok(a.includes('Content A'), 'a.md must contain Content A');
            assert.ok(b.includes('Content B'), 'b.md must contain Content B');

            fs.rmSync(outDir, { recursive: true, force: true });
        } finally {
            fs.unlinkSync(buildYaml);
        }
    });
});

describe('Contract: routing treats dest "." as a directory', () => {
    it('routes to the source basename even when cwd basename contains a dot', async () => {
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vasmc.routing.'));

        try {
            fs.writeFileSync(path.join(workspace, 'README.vasm.md'), [
                '---',
                'vasm:',
                '  alias: routed-readme',
                '  compile:',
                '    format: informational',
                '    targetLangs: ["en"]',
                '---',
                '# Routed README',
                '',
                'Body.',
                ''
            ].join('\n'), 'utf8');

            fs.writeFileSync(path.join(workspace, 'vasmc-build.yaml'), [
                'includes:',
                '  - "README.vasm.md"',
                'routing:',
                '  - match: "README.vasm.md"',
                '    dest: "."',
                ''
            ].join('\n'), 'utf8');

            run('build', workspace);

            assert.ok(fs.existsSync(path.join(workspace, 'README.md')), 'dest "." must write README.md in workspace root');
            const report = fs.readFileSync(path.join(workspace, '.vasmc', 'build-report.yaml'), 'utf8');
            assert.ok(report.includes('output: README.md'), 'report output must be README.md, not an empty relative path');
            assert.ok(!report.includes('output: ""'), 'report output must not be empty');
        } finally {
            fs.rmSync(workspace, { recursive: true, force: true });
        }
    });
});

// ─── Contract 5: Seal ─────────────────────────────────────────────

describe('Contract: seal injects Frontmatter and renames file', () => {
    it('creates .vasm.md with Frontmatter', async () => {
        const sealSource = path.join(FIXTURES, 'seal-test.md');
        fs.writeFileSync(sealSource, '# Seal Target\n\nSome content.\n', 'utf8');

        run(`seal seal-test.md`);

        const sealedPath = path.join(FIXTURES, 'seal-test.vasm.md');
        assert.ok(fs.existsSync(sealedPath), 'seal-test.vasm.md must exist');

        const content = fs.readFileSync(sealedPath, 'utf8');
        assert.ok(content.includes('---'), 'Must contain Frontmatter markers');
        assert.ok(content.includes('vasm:'), 'Must contain vasm metadata');
        assert.ok(content.includes('alias:'), 'Must contain alias field');

        // Cleanup
        if (fs.existsSync(sealSource)) fs.unlinkSync(sealSource);
        fs.unlinkSync(sealedPath);
    });
});

// ─── Contract 6: AI build report actions ──────────────────────────

describe('Contract: vasmc build generates structured report actions', () => {
    it('produces .vasmc/build-report.yaml with compiled file list and actions', async () => {
        const outDir = path.join(FIXTURES, 'out-ai-build');
        run(`build inline-test.vasm.md -o ${outDir}`);

        const instructionsPath = path.join(FIXTURES, '.vasmc', 'build-instructions.md');
        assert.ok(!fs.existsSync(instructionsPath), 'build-instructions.md must not be generated');

        const reportPath = path.join(FIXTURES, '.vasmc', 'build-report.yaml');
        assert.ok(fs.existsSync(reportPath), 'build-report.yaml must exist');
        const report = fs.readFileSync(reportPath, 'utf8');
        assert.ok(report.includes('version: 2'), 'report must use v2 schema');
        assert.ok(report.includes('mode: ai-build'), 'report must declare ai-build mode');
        assert.ok(report.includes('source: inline-test.vasm.md'), 'report must include source file');
        assert.ok(report.includes('compiledFiles:'), 'report must include compiledFiles section');
        assert.ok(report.includes('minimalTokenVariant:'), 'report must include minimal token variant');
        assert.ok(report.includes('actions:'), 'report must include structured actions');
        assert.ok(report.includes('type: verify'), 'report must include verify action');
        assert.ok(report.includes('policy:'), 'report must include policy section');
        assert.ok(report.includes('status: pass'), 'report must include policy pass status');

        fs.rmSync(outDir, { recursive: true, force: true });
        // Don't remove .vasmc — other tests may need it
    });
});

// ─── Contract 7: policy gate enforcement ──────────────────────────

describe('Contract: security.mode enforce blocks unsafe skill outputs', () => {
    it('does not update final output when manifest policy status is blocked', async () => {
        const buildYaml = path.join(FIXTURES, 'vasmc-build.yaml');
        const depPath = path.join(FIXTURES, 'unsafe-dep.vasm.md');
        const skillPath = path.join(FIXTURES, 'unsafe-skill.vasm.md');
        const outDir = path.join(FIXTURES, 'blocked-out');

        fs.writeFileSync(depPath, [
            '---',
            'vasm:',
            '  kind: fragment',
            '---',
            'Dependency uses a removed manifest field.'
        ].join('\n'), 'utf8');

        fs.writeFileSync(skillPath, [
            '---',
            'vasm:',
            '  alias: unsafe-skill',
            '  version: 1.0.0',
            '  compile:',
            '    format: executable',
            '---',
            '[Unsafe Dep](./unsafe-dep.vasm.md "@import:inline")'
        ].join('\n'), 'utf8');

        fs.writeFileSync(buildYaml, [
            'includes:',
            '  - "unsafe-skill.vasm.md"',
            'output:',
            '  dir: "./blocked-out"',
            'security:',
            '  mode: enforce'
        ].join('\n'), 'utf8');

        try {
            run('build');

            assert.ok(!fs.existsSync(path.join(outDir, 'unsafe-skill.md')), 'blocked skill output must not be written');

            const report = fs.readFileSync(path.join(FIXTURES, '.vasmc', 'build-report.yaml'), 'utf8');
            assert.ok(report.includes('status: blocked'), 'report must mark entry as blocked');
            assert.ok(report.includes('manifest.kind.removed'), 'report must include blocking manifest diagnostic');
            assert.ok(report.includes('type: policy_gate'), 'report must include Policy Gate report action');

            const instructionsPath = path.join(FIXTURES, '.vasmc', 'build-instructions.md');
            assert.ok(!fs.existsSync(instructionsPath), 'build-instructions.md must not be generated');
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
            for (const file of [buildYaml, depPath, skillPath]) {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            }
        }
    });
});

// ─── Contract 8: Project Review pass ──────────────────────────────

describe('Contract: projectReview emits context and action item', () => {
    it('writes project-review-context.yaml and records it in build report', async () => {
        const buildYaml = path.join(FIXTURES, 'vasmc-build.yaml');
        const contextSource = path.join(FIXTURES, 'project-review-source.md');
        const outDir = path.join(FIXTURES, 'out-project-review');

        fs.writeFileSync(contextSource, '# Project Review Source\n\nProject-specific guidance.\n', 'utf8');
        fs.writeFileSync(buildYaml, [
            'ai:',
            '  projectReview:',
            '    mode: suggest',
            '    include:',
            '      - "project-review-source.md"'
        ].join('\n'), 'utf8');

        try {
            run(`build inline-test.vasm.md -o ${outDir}`);

            const contextPath = path.join(FIXTURES, '.vasmc', 'project-review-context.yaml');
            assert.ok(fs.existsSync(contextPath), 'project-review-context.yaml must exist');

            const context = fs.readFileSync(contextPath, 'utf8');
            assert.ok(context.includes('mode: suggest'), 'context must include review mode');
            assert.ok(context.includes('project-review-source.md'), 'context must include configured file');

            const report = fs.readFileSync(path.join(FIXTURES, '.vasmc', 'build-report.yaml'), 'utf8');
            assert.ok(report.includes('projectReview:'), 'report must include projectReview section');
            assert.ok(report.includes('contextFile: .vasmc/project-review-context.yaml'), 'report must point to context file');
            assert.ok(report.includes('type: project_review'), 'report must include Project Review report action');

            const instructionsPath = path.join(FIXTURES, '.vasmc', 'build-instructions.md');
            assert.ok(!fs.existsSync(instructionsPath), 'build-instructions.md must not be generated');
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
            for (const file of [buildYaml, contextSource]) {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            }
        }
    });
});

// ─── Contract 9: AI CLI command surface ───────────────────────────

describe('Contract: vasmc does not expose legacy agent command', () => {
    it('rejects agent as an unknown command', async () => {
        assert.throws(
            () => execSync(`node ${CLI} agent inline-test.vasm.md`, {
                cwd: FIXTURES,
                encoding: 'utf8',
                env: { ...process.env, NO_COLOR: '1' },
                stdio: 'pipe'
            }),
            /unknown command 'agent'/
        );
    });
});
