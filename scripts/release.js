#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageDirs = ['packages/core', 'packages/cli', 'packages/console'];
const allTargets = ['npm', 'github', 'gitlab'];

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function usage() {
    return [
        'Usage:',
        '  npm run release -- [options]',
        '',
        'Targets:',
        '  npm       Publish packages to npmjs via changeset publish --no-git-tag.',
        '  github    Push branch/tags to GitHub and create a GitHub release.',
        '  gitlab    Push branch/tags to GitLab and create a GitLab release.',
        '',
        'Options:',
        '  --only <targets>       Comma-separated target list, e.g. github,npm.',
        '  --skip <targets>       Comma-separated target list to exclude.',
        '  --dry-run              Print mutating commands without executing them.',
        '  --no-check             Skip npm run release:check.',
        '  --tag <tag>            Aggregate release tag. Defaults to v<version>.',
        '  --npm-tag <tag>        npm dist-tag passed to changeset publish.',
        '  --otp <code>           npm one-time password passed to changeset publish.',
        '  --github-remote <name> GitHub git remote. Defaults to github.',
        '  --gitlab-remote <name> GitLab git remote. Defaults to gitlab.',
        '  --github-repo <repo>   gh repo selector. Defaults to glenzli/vasmc.',
        '  --gitlab-repo <repo>   glab repo selector. Defaults to glenzli/vasmc.',
        '',
        'Examples:',
        '  npm run release',
        '  npm run release -- --only npm',
        '  npm run release -- --only gitlab,npm',
        '  npm run release -- --skip github',
        '  npm run release -- --dry-run',
    ].join('\n');
}

function parseList(value) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeTarget(target) {
    if (target === 'npmjs') return 'npm';
    if (target === 'all') return 'all';
    return target;
}

function parseArgs(argv) {
    const options = {
        dryRun: false,
        check: true,
        only: [],
        skip: [],
        tag: undefined,
        npmTag: undefined,
        otp: undefined,
        githubRemote: 'github',
        gitlabRemote: 'gitlab',
        githubRepo: 'glenzli/vasmc',
        gitlabRepo: 'glenzli/vasmc',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const nextValue = () => {
            const value = argv[i + 1];
            if (!value || value.startsWith('--')) {
                throw new Error(`Missing value for ${arg}`);
            }
            i += 1;
            return value;
        };

        if (arg === '--help' || arg === '-h') {
            console.log(usage());
            process.exit(0);
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--no-check') {
            options.check = false;
        } else if (arg === '--only' || arg === '--target' || arg === '--targets') {
            options.only.push(...parseList(nextValue()));
        } else if (arg.startsWith('--only=')) {
            options.only.push(...parseList(arg.slice('--only='.length)));
        } else if (arg.startsWith('--target=')) {
            options.only.push(...parseList(arg.slice('--target='.length)));
        } else if (arg.startsWith('--targets=')) {
            options.only.push(...parseList(arg.slice('--targets='.length)));
        } else if (arg === '--skip' || arg === '--exclude') {
            options.skip.push(...parseList(nextValue()));
        } else if (arg.startsWith('--skip=')) {
            options.skip.push(...parseList(arg.slice('--skip='.length)));
        } else if (arg.startsWith('--exclude=')) {
            options.skip.push(...parseList(arg.slice('--exclude='.length)));
        } else if (arg === '--tag') {
            options.tag = nextValue();
        } else if (arg.startsWith('--tag=')) {
            options.tag = arg.slice('--tag='.length);
        } else if (arg === '--npm-tag') {
            options.npmTag = nextValue();
        } else if (arg.startsWith('--npm-tag=')) {
            options.npmTag = arg.slice('--npm-tag='.length);
        } else if (arg === '--otp') {
            options.otp = nextValue();
        } else if (arg.startsWith('--otp=')) {
            options.otp = arg.slice('--otp='.length);
        } else if (arg === '--github-remote') {
            options.githubRemote = nextValue();
        } else if (arg.startsWith('--github-remote=')) {
            options.githubRemote = arg.slice('--github-remote='.length);
        } else if (arg === '--gitlab-remote') {
            options.gitlabRemote = nextValue();
        } else if (arg.startsWith('--gitlab-remote=')) {
            options.gitlabRemote = arg.slice('--gitlab-remote='.length);
        } else if (arg === '--github-repo') {
            options.githubRepo = nextValue();
        } else if (arg.startsWith('--github-repo=')) {
            options.githubRepo = arg.slice('--github-repo='.length);
        } else if (arg === '--gitlab-repo') {
            options.gitlabRepo = nextValue();
        } else if (arg.startsWith('--gitlab-repo=')) {
            options.gitlabRepo = arg.slice('--gitlab-repo='.length);
        } else {
            throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
        }
    }

    const only = options.only.map(normalizeTarget);
    const skip = new Set(options.skip.map(normalizeTarget));
    let targets = only.length > 0 && !only.includes('all') ? only : allTargets;
    targets = [...new Set(targets)].filter((target) => !skip.has(target));

    for (const target of targets) {
        if (!allTargets.includes(target)) {
            throw new Error(`Unknown release target: ${target}. Expected one of: ${allTargets.join(', ')}`);
        }
    }

    if (targets.length === 0) {
        throw new Error('No release targets selected.');
    }

    return { ...options, targets };
}

function commandLine(command, args) {
    return [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ');
}

function run(command, args, options = {}) {
    const line = commandLine(command, args);
    if (options.dryRun && options.mutates) {
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
        throw new Error(`Working tree is not clean. Commit or stash changes before release.\n${status}`);
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

function ensureTag(tag, commit, message, options) {
    if (!tagExists(tag)) {
        run('git', ['tag', '-a', tag, commit, '-m', message], { mutates: true, dryRun: options.dryRun });
        return;
    }

    const existingCommit = tagCommit(tag);
    if (existingCommit !== commit) {
        throw new Error(`Tag ${tag} points to ${existingCommit}, expected ${commit}.`);
    }
}

function releaseCommitRange(tag) {
    const previous = run('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', 'HEAD^'], {
        capture: true,
        allowFailure: true,
    });
    if (previous.ok && previous.stdout.trim()) {
        return `${previous.stdout.trim()}..HEAD`;
    }
    return undefined;
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
    const range = releaseCommitRange(tag);
    const commits = range
        ? run('git', ['log', '--oneline', '--no-merges', range], { capture: true }).split(/\r?\n/).filter(Boolean)
        : [];
    const changeLines = bullets.length > 0
        ? bullets
        : (commits.length > 0 ? commits.map((line) => `- ${line}`) : ['- See repository history for details.']);

    return [
        `# ${tag}`,
        '',
        '## Package versions',
        ...packages.map((pkg) => `- \`${pkg.name}@${pkg.version}\``),
        '',
        '## Changes',
        ...changeLines,
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

function packageInfo(rootVersion) {
    const packages = packageDirs.map((dir) => {
        const pkg = readJson(path.join(dir, 'package.json'));
        return {
            dir,
            name: pkg.name,
            version: pkg.version,
            tag: `${pkg.name}@${pkg.version}`,
        };
    });

    const mismatched = packages.filter((pkg) => pkg.version !== rootVersion);
    if (mismatched.length > 0) {
        throw new Error(`Package versions must match root ${rootVersion}: ${mismatched.map((pkg) => `${pkg.name}@${pkg.version}`).join(', ')}`);
    }

    return packages;
}

function ensureReleaseTags(releaseTag, packages, options) {
    const commit = run('git', ['rev-parse', 'HEAD'], { capture: true });
    ensureTag(releaseTag, commit, `Release ${releaseTag}`, options);
    for (const pkg of packages) {
        ensureTag(pkg.tag, commit, `Release ${pkg.tag}`, options);
    }
}

function npmPackagePublished(pkg, options) {
    if (options.dryRun) return false;
    const result = run('npm', ['--registry', 'https://registry.npmjs.org', 'view', `${pkg.name}@${pkg.version}`, 'version'], {
        capture: true,
        allowFailure: true,
    });
    return result.ok && result.stdout.trim() === pkg.version;
}

function publishNpm(packages, options) {
    const unpublished = packages.filter((pkg) => !npmPackagePublished(pkg, options));
    if (unpublished.length === 0 && !options.dryRun) {
        console.log('npm packages already published.');
        return;
    }

    const args = ['publish', '--no-git-tag'];
    if (options.npmTag) args.push('--tag', options.npmTag);
    if (options.otp) args.push('--otp', options.otp);
    run('./node_modules/.bin/changeset', args, { mutates: true, dryRun: options.dryRun });

    if (!options.dryRun) {
        for (const pkg of packages) {
            if (!npmPackagePublished(pkg, options)) {
                throw new Error(`npm package is not published or not yet visible: ${pkg.name}@${pkg.version}`);
            }
        }
    }
}

function pushRemote(remote, branch, releaseTag, packages, options) {
    run('git', ['remote', 'get-url', remote], { capture: true });
    run('git', ['push', remote, branch], { mutates: true, dryRun: options.dryRun });
    run('git', ['push', remote, releaseTag, ...packages.map((pkg) => pkg.tag)], { mutates: true, dryRun: options.dryRun });
}

function notesFileFor(tag, packages) {
    const file = path.join(os.tmpdir(), `vasmc-${tag}-release-notes.md`);
    fs.writeFileSync(file, releaseNotes(tag, packages));
    return file;
}

function releaseGithub(releaseTag, packages, branch, options) {
    pushRemote(options.githubRemote, branch, releaseTag, packages, options);
    if (options.dryRun) {
        run('gh', ['release', 'create', releaseTag, '--repo', options.githubRepo, '--verify-tag', '--latest', '--title', releaseTag, '--notes-file', '<generated>'], { mutates: true, dryRun: true });
        return;
    }

    run('gh', ['auth', 'status']);
    const existing = run('gh', ['release', 'view', releaseTag, '--repo', options.githubRepo, '--json', 'url'], {
        capture: true,
        allowFailure: true,
    });
    if (existing.ok) {
        const parsed = JSON.parse(existing.stdout);
        console.log(`GitHub release already exists: ${parsed.url}`);
        return;
    }

    run('gh', ['release', 'create', releaseTag, '--repo', options.githubRepo, '--verify-tag', '--latest', '--title', releaseTag, '--notes-file', notesFileFor(releaseTag, packages)], {
        mutates: true,
    });
}

function releaseGitlab(releaseTag, packages, branch, options) {
    pushRemote(options.gitlabRemote, branch, releaseTag, packages, options);
    if (options.dryRun) {
        run('glab', ['release', 'create', releaseTag, '--repo', options.gitlabRepo, '--name', releaseTag, '--notes-file', '<generated>', '--no-update'], { mutates: true, dryRun: true });
        return;
    }

    run('glab', ['auth', 'status']);
    const existing = run('glab', ['release', 'view', releaseTag, '--repo', options.gitlabRepo, '--output', 'json'], {
        capture: true,
        allowFailure: true,
    });
    if (existing.ok) {
        console.log(`GitLab release already exists: ${releaseTag}`);
        return;
    }

    run('glab', ['release', 'create', releaseTag, '--repo', options.gitlabRepo, '--name', releaseTag, '--notes-file', notesFileFor(releaseTag, packages), '--no-update'], {
        mutates: true,
    });
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const rootPackage = readJson('package.json');
    const version = rootPackage.version;
    const releaseTag = options.tag || `v${version}`;
    const branch = run('git', ['branch', '--show-current'], { capture: true });
    if (!branch) throw new Error('Cannot release from a detached HEAD.');

    const packages = packageInfo(version);
    console.log(`Release ${releaseTag}: ${options.targets.join(', ')}`);

    ensureCleanWorktree();
    if (options.check) {
        run('npm', ['run', 'release:check'], { mutates: true, dryRun: options.dryRun });
        if (!options.dryRun) ensureCleanWorktree();
    }

    ensureReleaseTags(releaseTag, packages, options);
    if (options.targets.includes('npm')) publishNpm(packages, options);
    if (options.targets.includes('github')) releaseGithub(releaseTag, packages, branch, options);
    if (options.targets.includes('gitlab')) releaseGitlab(releaseTag, packages, branch, options);
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
