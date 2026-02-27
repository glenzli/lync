const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Since tsup bundles everything into a single file, we test via the CLI directly
// and also test the tsc-compiled modules for unit-level coverage.
// For unit tests we need individual modules, so we compile with tsc to a temp dir.
const { execSync } = require('child_process');

const FIXTURES = path.join(__dirname, 'fixtures');
const TSC_OUT = path.join(__dirname, '.tsc-out');

// Compile with tsc to get individual modules for unit testing
before(() => {
    execSync(`npx tsc --outDir ${TSC_OUT}`, { cwd: path.join(__dirname, '..') });
});

after(() => {
    fs.rmSync(TSC_OUT, { recursive: true, force: true });
});

function load(mod) {
    return require(path.join(TSC_OUT, mod));
}

// ─── Config Tests ───────────────────────────────────────────────────
describe('Config Layer', () => {
    before(() => {
        fs.mkdirSync(FIXTURES, { recursive: true });
    });

    after(() => {
        fs.rmSync(FIXTURES, { recursive: true, force: true });
    });

    it('loadConfig returns empty deps when file is missing', () => {
        const { loadConfig } = load('config');
        const config = loadConfig(FIXTURES);
        assert.deepStrictEqual(config.dependencies, {});
    });

    it('saveConfig and loadConfig round-trip correctly', () => {
        const { loadConfig, saveConfig } = load('config');
        const original = {
            dependencies: {
                foo: 'https://example.com/foo.md',
                bar: { url: 'https://example.com/bar.md', dest: './bar.md' }
            }
        };
        saveConfig(original, FIXTURES);
        const loaded = loadConfig(FIXTURES);
        assert.strictEqual(loaded.dependencies.foo, 'https://example.com/foo.md');
        assert.strictEqual(loaded.dependencies.bar.url, 'https://example.com/bar.md');
        assert.strictEqual(loaded.dependencies.bar.dest, './bar.md');
    });

    it('saveLockfile and loadLockfile round-trip correctly', () => {
        const { loadLockfile, saveLockfile } = load('config');
        const lock = {
            version: 1,
            dependencies: {
                foo: {
                    url: 'https://example.com/foo.md',
                    hash: 'abc123',
                    fetchedAt: '2026-01-01T00:00:00.000Z'
                }
            }
        };
        saveLockfile(lock, FIXTURES);
        const loaded = loadLockfile(FIXTURES);
        assert.strictEqual(loaded.version, 1);
        assert.strictEqual(loaded.dependencies.foo.hash, 'abc123');
    });

    it('loadBuildConfig returns defaults when file is missing', () => {
        const { loadBuildConfig } = load('config');
        const build = loadBuildConfig(FIXTURES);
        assert.deepStrictEqual(build.includes, []);
        assert.strictEqual(build.outDir, './dist');
    });
});

// ─── Network Tests ──────────────────────────────────────────────────
describe('Network Layer', () => {
    it('computeHash produces deterministic SHA-256 hex', () => {
        const { computeHash } = load('network');
        const hash1 = computeHash('hello world');
        const hash2 = computeHash('hello world');
        assert.strictEqual(hash1, hash2);
        assert.strictEqual(hash1.length, 64);
    });

    it('computeHash produces different hashes for different inputs', () => {
        const { computeHash } = load('network');
        const a = computeHash('aaa');
        const b = computeHash('bbb');
        assert.notStrictEqual(a, b);
    });
});

// ─── Compiler Tests ─────────────────────────────────────────────────
describe('Compiler', () => {
    const compilerDir = path.join(FIXTURES, 'compiler-test');

    before(() => {
        const { computeHash } = load('network');
        fs.mkdirSync(compilerDir, { recursive: true });
        fs.mkdirSync(path.join(compilerDir, '.lync'), { recursive: true });

        fs.writeFileSync(
            path.join(compilerDir, '.lync', 'greet.md'),
            '# Hello\n\nWorld!\n',
            'utf8'
        );

        fs.writeFileSync(
            path.join(compilerDir, 'lync.yaml'),
            'dependencies:\n  greet: "https://example.com/greet.md"\n',
            'utf8'
        );

        const lockContent = `version: 1\ndependencies:\n  greet:\n    url: "https://example.com/greet.md"\n    hash: "${computeHash('# Hello\n\nWorld!\n')}"\n    fetchedAt: "2026-01-01T00:00:00.000Z"\n`;
        fs.writeFileSync(
            path.join(compilerDir, 'lync-lock.yaml'),
            lockContent,
            'utf8'
        );

        fs.writeFileSync(
            path.join(compilerDir, 'link.lync.md'),
            '# Test\n\n[Greet](lync:greet "@import:link")\n',
            'utf8'
        );

        fs.writeFileSync(
            path.join(compilerDir, 'inline.lync.md'),
            '# Test\n\n[Greet](lync:greet "@import:inline")\n',
            'utf8'
        );
    });

    after(() => {
        fs.rmSync(compilerDir, { recursive: true, force: true });
    });

    it('@import:link rewrites URL to relative path', async () => {
        const { compileFile } = load('compiler');
        const cwd = process.cwd();
        process.chdir(compilerDir);
        try {
            const srcPath = path.join(compilerDir, 'link.lync.md');
            const outPath = path.join(compilerDir, 'dist', 'link.md');
            const result = await compileFile(srcPath, outPath);
            assert.ok(!result.includes('lync:greet'), 'lync:greet should be rewritten');
            assert.ok(result.includes('.lync/greet.md'), 'Should contain relative path to .lync/greet.md');
        } finally {
            process.chdir(cwd);
        }
    });

    it('@import:inline expands content in-place', async () => {
        const { compileFile } = load('compiler');
        const cwd = process.cwd();
        process.chdir(compilerDir);
        try {
            const srcPath = path.join(compilerDir, 'inline.lync.md');
            const outPath = path.join(compilerDir, 'dist', 'inline.md');
            const result = await compileFile(srcPath, outPath);
            assert.ok(!result.includes('lync:greet'), 'lync:greet should be expanded');
            assert.ok(result.includes('Hello'), 'Should contain the inlined "Hello"');
            assert.ok(result.includes('World!'), 'Should contain the inlined "World!"');
        } finally {
            process.chdir(cwd);
        }
    });
});
