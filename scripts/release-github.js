#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageDirs = ['packages/core', 'packages/cli', 'packages/console'];
const dryRun = process.argv.includes('--dry-run');

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function commandLine(command, args) {
    return [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ');
}

function run(command, args, options = {}) {
    const line = commandLine(command, args);
    if (dryRun && options.mutates) {
        console.log(`[dry-run] ${line}`);
        return '';
    }

    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    if (result.status !== 0) {
        if (options.allowFailure) {
            return {
                ok: false,
                stdout: result.stdout || '',
                stderr: result.stderr || '',
            };
        }
        const detail = options.capture ? `\n${result.stderr || result.stdout || ''}` : '';
        throw new Error(`Command failed: ${line}${detail}`);
    }

    if (options.allowFailure) {
        return {
            ok: true,
            stdout: result.stdout || '',
            stderr: result.stderr || '',
        };
    }
    return options.capture ? result.stdout.trim() : '';
}

function ensureCleanWorktree() {
    const status = run('git', ['status', '--short'], { capture: true });
    if (status) {
        throw new Error(`Working tree is not clean. Commit or stash changes before creating a release.\n${status}`);
    }
}

function tagExists(tag) {
    const result = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
        cwd: process.cwd(),
        stdio: 'ignore',
    });
    return result.status === 0;
}

function tagCommit(tag) {
    return run('git', ['rev-list', '-n', '1', tag], { capture: true });
}

function ensureTagExists(tag) {
    if (!tagExists(tag)) {
        throw new Error(`Required tag does not exist: ${tag}. Run npm publishing before GitHub release finalization.`);
    }
    return tagCommit(tag);
}

function ensureNpmPackagePublished(pkg) {
    const result = run('npm', ['--registry', 'https://registry.npmjs.org', 'view', `${pkg.name}@${pkg.version}`, 'version'], {
        capture: true,
        allowFailure: true,
    });
    if (!result.ok || result.stdout.trim() !== pkg.version) {
        throw new Error(`npm package is not published or not yet visible: ${pkg.name}@${pkg.version}`);
    }
}

function releaseCommitForPackageTags(packages) {
    const commits = packages.map((pkg) => ({
        tag: pkg.tag,
        commit: ensureTagExists(pkg.tag),
    }));
    const uniqueCommits = [...new Set(commits.map((entry) => entry.commit))];
    if (uniqueCommits.length !== 1) {
        throw new Error(`Package tags do not point to the same commit: ${commits.map((entry) => `${entry.tag}=${entry.commit}`).join(', ')}`);
    }

    const releaseCommit = uniqueCommits[0];
    const ancestor = run('git', ['merge-base', '--is-ancestor', releaseCommit, 'HEAD'], {
        capture: true,
        allowFailure: true,
    });
    if (!ancestor.ok) {
        throw new Error(`Release commit ${releaseCommit} is not contained in the current branch.`);
    }
    return releaseCommit;
}

function ensureAggregateTag(tag, releaseCommit) {
    if (!tagExists(tag)) {
        run('git', ['tag', '-a', tag, releaseCommit, '-m', `Release ${tag}`], { mutates: true });
        return;
    }

    const commit = tagCommit(tag);
    if (commit !== releaseCommit) {
        throw new Error(`Release tag ${tag} points to ${commit}, but package tags point to ${releaseCommit}.`);
    }
}

function extractChangelogBullets(packageDir, version) {
    const changelog = path.join(packageDir, 'CHANGELOG.md');
    if (!fs.existsSync(changelog)) return [];

    const lines = fs.readFileSync(changelog, 'utf8').split(/\r?\n/);
    const heading = `## ${version}`;
    const start = lines.findIndex((line) => line.trim() === heading);
    if (start === -1) return [];

    const bullets = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.startsWith('## ')) break;
        if (line.startsWith('- ')) bullets.push(line);
    }
    return bullets;
}

function releaseNotes(tag, packages) {
    const version = tag.replace(/^v/, '');
    const bullets = [
        ...new Set(packages.flatMap((pkg) => extractChangelogBullets(pkg.dir, version))),
    ];

    return [
        `# ${tag}`,
        '',
        '## Published npm packages',
        ...packages.map((pkg) => `- \`${pkg.name}@${pkg.version}\``),
        '',
        '## Changes',
        ...(bullets.length > 0 ? bullets : ['- See package changelogs for details.']),
        '',
        '## Install',
        '',
        '```bash',
        'npm install -g @vasm/cli',
        'npm install -g @vasm/console',
        '```',
        '',
    ].join('\n');
}

function main() {
    const rootPackage = readJson('package.json');
    const version = rootPackage.version;
    const releaseTag = process.env.RELEASE_TAG || `v${version}`;
    const branch = run('git', ['branch', '--show-current'], { capture: true });
    if (!branch) {
        throw new Error('Cannot release from a detached HEAD.');
    }

    const packages = packageDirs.map((dir) => {
        const pkg = readJson(path.join(dir, 'package.json'));
        return {
            dir,
            name: pkg.name,
            version: pkg.version,
            tag: `${pkg.name}@${pkg.version}`,
        };
    });

    const mismatched = packages.filter((pkg) => pkg.version !== version);
    if (mismatched.length > 0) {
        throw new Error(`Package versions must match root ${version}: ${mismatched.map((pkg) => `${pkg.name}@${pkg.version}`).join(', ')}`);
    }

    ensureCleanWorktree();
    const releaseCommit = releaseCommitForPackageTags(packages);
    packages.forEach((pkg) => ensureNpmPackagePublished(pkg));
    ensureAggregateTag(releaseTag, releaseCommit);

    run('gh', ['auth', 'status']);

    run('git', ['push', 'origin', branch, '--follow-tags'], { mutates: true });

    const existing = run('gh', ['release', 'view', releaseTag, '--json', 'url'], {
        capture: true,
        allowFailure: true,
    });
    if (existing.ok) {
        const parsed = JSON.parse(existing.stdout);
        console.log(`GitHub release already exists: ${parsed.url}`);
        return;
    }

    const notesFile = path.join(os.tmpdir(), `vasmc-${releaseTag}-release-notes.md`);
    fs.writeFileSync(notesFile, releaseNotes(releaseTag, packages));
    run('gh', ['release', 'create', releaseTag, '--verify-tag', '--latest', '--title', releaseTag, '--notes-file', notesFile], {
        mutates: true,
    });
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
