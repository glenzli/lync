const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadConfig, saveConfig, loadLockfile, saveLockfile, loadBuildConfig } = require('../dist/config');
const { computeHash } = require('../dist/network');
const { compileFile } = require('../dist/compiler');

const FIXTURES = path.join(__dirname, 'fixtures');

// ─── Config Tests ───────────────────────────────────────────────────
describe('Config Layer', () => {
    before(() => {
        fs.mkdirSync(FIXTURES, { recursive: true });
    });

    after(() => {
        fs.rmSync(FIXTURES, { recursive: true, force: true });
    });

    it('loadConfig returns empty deps when file is missing', () => {
        const config = loadConfig(FIXTURES);
        assert.deepStrictEqual(config.dependencies, {});
    });

    it('saveConfig and loadConfig round-trip correctly', () => {
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
        const build = loadBuildConfig(FIXTURES);
        assert.deepStrictEqual(build.includes, []);
        assert.strictEqual(build.outDir, './dist');
    });
});

// ─── Network Tests ──────────────────────────────────────────────────
describe('Network Layer', () => {
    it('computeHash produces deterministic SHA-256 hex', () => {
        const hash1 = computeHash('hello world');
        const hash2 = computeHash('hello world');
        assert.strictEqual(hash1, hash2);
        assert.strictEqual(hash1.length, 64); // SHA-256 = 64 hex chars
    });

    it('computeHash produces different hashes for different inputs', () => {
        const a = computeHash('aaa');
        const b = computeHash('bbb');
        assert.notStrictEqual(a, b);
    });
});

// ─── Compiler Tests ─────────────────────────────────────────────────
describe('Compiler', () => {
    const compilerDir = path.join(FIXTURES, 'compiler-test');

    before(() => {
        fs.mkdirSync(compilerDir, { recursive: true });
        fs.mkdirSync(path.join(compilerDir, '.lync'), { recursive: true });

        // Write a dependency file
        fs.writeFileSync(
            path.join(compilerDir, '.lync', 'greet.md'),
            '# Hello\n\nWorld!\n',
            'utf8'
        );

        // Write lync.yaml
        fs.writeFileSync(
            path.join(compilerDir, 'lync.yaml'),
            'dependencies:\n  greet: "https://example.com/greet.md"\n',
            'utf8'
        );

        // Write lync-lock.yaml
        const lockContent = `version: 1\ndependencies:\n  greet:\n    url: "https://example.com/greet.md"\n    hash: "${computeHash('# Hello\n\nWorld!\n')}"\n    fetchedAt: "2026-01-01T00:00:00.000Z"\n`;
        fs.writeFileSync(
            path.join(compilerDir, 'lync-lock.yaml'),
            lockContent,
            'utf8'
        );

        // Write a source file with @import:link
        fs.writeFileSync(
            path.join(compilerDir, 'link.src.md'),
            '# Test\n\n[Greet](lync:greet "@import:link")\n',
            'utf8'
        );

        // Write a source file with @import:inline
        fs.writeFileSync(
            path.join(compilerDir, 'inline.src.md'),
            '# Test\n\n[Greet](lync:greet "@import:inline")\n',
            'utf8'
        );

        // Write circular import files
        fs.mkdirSync(path.join(compilerDir, '.lync'), { recursive: true });
        fs.writeFileSync(
            path.join(compilerDir, '.lync', 'circular.md'),
            '[Self](lync:circular "@import:inline")\n',
            'utf8'
        );
        const circLock = `version: 1\ndependencies:\n  circular:\n    url: "https://example.com/circular.md"\n    hash: "fakehash"\n    fetchedAt: "2026-01-01T00:00:00.000Z"\n`;
        fs.writeFileSync(
            path.join(compilerDir, 'lync-lock-circular.yaml'),
            circLock,
            'utf8'
        );
    });

    after(() => {
        fs.rmSync(compilerDir, { recursive: true, force: true });
    });

    it('@import:link rewrites URL to relative path', async () => {
        const cwd = process.cwd();
        process.chdir(compilerDir);
        try {
            const srcPath = path.join(compilerDir, 'link.src.md');
            const outPath = path.join(compilerDir, 'dist', 'link.md');
            const result = await compileFile(srcPath, outPath);
            // The link should now point to a relative path instead of lync:greet
            assert.ok(!result.includes('lync:greet'), 'lync:greet should be rewritten');
            assert.ok(result.includes('.lync/greet.md'), 'Should contain relative path to .lync/greet.md');
        } finally {
            process.chdir(cwd);
        }
    });

    it('@import:inline expands content in-place', async () => {
        const cwd = process.cwd();
        process.chdir(compilerDir);
        try {
            const srcPath = path.join(compilerDir, 'inline.src.md');
            const outPath = path.join(compilerDir, 'dist', 'inline.md');
            const result = await compileFile(srcPath, outPath);
            // The output should contain the inlined content
            assert.ok(!result.includes('lync:greet'), 'lync:greet should be expanded');
            assert.ok(result.includes('Hello'), 'Should contain the inlined "Hello"');
            assert.ok(result.includes('World!'), 'Should contain the inlined "World!"');
        } finally {
            process.chdir(cwd);
        }
    });
});
