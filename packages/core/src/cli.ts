import { Command } from 'commander';
import { glob } from 'glob';
import { syncDependencies } from './sync';
import { loadConfig, saveConfig, loadLockfile, saveLockfile } from './config';
import { compileEntry, resolveSingleWorkspaceEntry, runWorkspaceBuild, runAIBuild, runAIBuildEntry } from './build';
import { compileFile } from './compiler';
import { detectLanguage } from './utils';
import { fetchMarkdown } from './network';
import * as path from 'path';
import * as fs from 'fs';
import { initI18n, t } from './i18n';
import { generateGraph } from './graph';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { assertCompileFormat, formatDeprecationMessage } from './formats';
import type { CompileFormat } from './formats';

export interface CLIProfileOptions {
    name?: string;
    description?: string;
    includeAgent?: boolean;
    buildMode?: 'deterministic' | 'ai';
}

function normalizeCliCompileFormat(rawFormat: unknown, fileLabel: string, fallback: CompileFormat = 'executable'): CompileFormat {
    const normalized = assertCompileFormat(rawFormat, fileLabel, fallback);
    if (normalized.deprecated) {
        console.warn(formatDeprecationMessage(normalized.deprecated, fileLabel));
    }
    return normalized.format;
}

export function setupCLI(options: CLIProfileOptions = {}): Command {
    const program = new Command();

    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
    const includeAgent = options.includeAgent ?? false;
    const buildMode = options.buildMode ?? 'deterministic';

    program
        .name(options.name || 'vasmc')
        .description(options.description || 'A decentralized markdown package manager and compiler.')
        .version(pkg.version || '0.1.0')
        .option('--lang <lang>', 'Global language for CLI interactive outputs (e.g. en, zh-CN)')
        .hook('preAction', (thisCommand) => {
            initI18n(thisCommand.opts().lang);
        });

    program
        .command('init')
        .description('Initialize a default vasmc-build.yaml configuration file')
        .action(() => {
            const configPath = path.resolve(process.cwd(), 'vasmc-build.yaml');
            if (fs.existsSync(configPath)) {
                console.log(t('INIT_WARN_EXISTS'));
                return;
            }

            const defaultConfig = `# VASMC Build Configuration
# Determines how the VASMC compiler will assemble and output your Markdown modules.

# The entry files to compile
includes:
  - "**/*.vasm.md"

# The output destination directory
output:
  dir: "./dist"
  # flat: true # Uncomment to ignore baseDir hierarchy and compile everything directly into dir
  # inPlace: true # Uncomment to compile files directly alongside their source (e.g., a/prompt.vasm.md -> a/prompt.md)

# Strip this prefix directory from the original paths
baseDir: "."

# Cross-compilation targets per output format (optional)
# By default, VASMC infers languages automatically from <!-- lang:xxx --> blocks in your source.
# Uncomment below to force explicit language generation:
# compile:
#   informational:                # Informational format: multi-language merge into one file
#     targetLangs: ["en", "zh-CN"]
#   executable:                   # Executable prompt format: one file per language
#     targetLangs: ["en"]
# Integrative sources are source-only composition guidance and are not cross-compiled.

# Advanced Routing Interceptors (optional)
# routing:
#   - match: "src/agents/*.vasm.md"
#     dest: "./dist/agents/"
`;
            fs.writeFileSync(configPath, defaultConfig, 'utf8');
            console.log(t('INIT_SUCCESS'));
        });

    program
        .command('add <url>')
        .description('Add a remote dependency')
        .option('--alias <alias>', 'Explicitly set the alias name')
        .option('--dest <dest>', 'Explicitly set local destination path')
        .action(async (url: string, options: { alias?: string; dest?: string }) => {
            const config = loadConfig();
            config.dependencies = config.dependencies || {};

            let alias = options.alias;

            if (!alias) {
                // Fetch to memory first to check for declarative alias
                console.log(t('ADD_FETCHING', url));
                try {
                    const content = await fetchMarkdown(url);
                    const parsed = parseFrontmatter(content);

                    if (parsed.data.vasm && parsed.data.vasm.alias) {
                        alias = parsed.data.vasm.alias;
                        console.log(t('ADD_DISCOVERED_ALIAS', alias as string));
                    }
                } catch (e: any) {
                    // Suppress error, fallback to URL parsing silently
                }
            }

            // Fallback: Smart Heuristic URL Extraction
            if (!alias) {
                try {
                    const urlObj = new URL(url);
                    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

                    if (pathSegments.length > 0) {
                        let basename = pathSegments[pathSegments.length - 1];
                        // Strip common extensions (including multipart like .zh-CN.md)
                        basename = basename.split('.')[0] || basename;

                        const genericNames = [
                            // General structure & Git
                            'readme', 'index', 'main', 'default', 'master', 'refs', 'heads', 'tree', 'blob', 'base', 'about', 'info', 'doc', 'docs',
                            'src', 'lib', 'pkg', 'bin', 'scripts', 'dist', 'build',
                            // Prompt specific
                            'prompt', 'prompts', 'system', 'user', 'assistant', 'template', 'instructions', 'rules',
                            // Config
                            'config', 'settings'
                        ];

                        // Start from the last segment and walk backwards
                        let foundAlias = false;
                        for (let i = pathSegments.length - 1; i >= 0; i--) {
                            let segment = pathSegments[i];
                            // Only strip extension if it's the very last segment (a file)
                            if (i === pathSegments.length - 1) {
                                segment = segment.split('.')[0] || segment;
                            }

                            if (!genericNames.includes(segment.toLowerCase())) {
                                alias = segment;
                                foundAlias = true;
                                if (i < pathSegments.length - 1) {
                                    console.log(t('ADD_GENERIC_PATH', alias));
                                }
                                break;
                            }
                        }

                        // If the entire path was made of generic words, or no valid segment found, fallback
                        if (!foundAlias) {
                            alias = basename; // Stick to the file name
                        }
                    } else {
                        alias = 'unnamed-dep';
                    }
                } catch (e) {
                    alias = 'unnamed-dep';
                }
            }

            // 2. Collision Resolution
            let finalAlias = alias as string;
            let counter = 1;
            while (config.dependencies![finalAlias]) {
                const existingDecl = config.dependencies![finalAlias];
                const existingUrl = typeof existingDecl === 'string' ? existingDecl : existingDecl.url;

                if (existingUrl === url) {
                    break;
                }

                finalAlias = `${alias}-${counter}`;
                counter++;
            }

            // Add to config
            config.dependencies = config.dependencies || {};
            if (options.dest) {
                config.dependencies![finalAlias] = { url, dest: options.dest };
            } else {
                config.dependencies![finalAlias] = url;
            }

            saveConfig(config);
            console.log(t('ADD_SUCCESS', finalAlias, url));

            await syncDependencies();
        });

    program
        .command('seal [patterns...]')
        .description('Convert standard markdown files into VASMC modules by injecting Frontmatter. Supports wildcards.')
        .option('--alias <alias>', 'Explicitly set the alias name (only recommended for single files)')
        .option('--lang <lang>', 'Wrap content in a specific language block (e.g. ja, zh-CN)')
        .option('--format <format>', 'Compile format: executable (default), informational, or integrative')
        .action(async (patterns: string[], options: { alias?: string; lang?: string; format?: string }) => {
            if (!patterns || patterns.length === 0) {
                console.error(t('SEAL_ERR_NO_FILES'));
                process.exit(1);
            }

            const matchedFiles = new Set<string>();
            for (const pattern of patterns) {
                const files = await glob(pattern, { cwd: process.cwd(), absolute: true });
                files.forEach(f => matchedFiles.add(f));
            }

            if (matchedFiles.size === 0) {
                console.error(t('SEAL_ERR_NO_MATCH'));
                process.exit(1);
            }

            for (const absolutePath of matchedFiles) {
                if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;

                const file = path.relative(process.cwd(), absolutePath);
                const rawContent = fs.readFileSync(absolutePath, 'utf8');
                const parsed = parseFrontmatter(rawContent);

                if (parsed.data.vasm) {
                    console.warn(t('SEAL_WARN_EXISTS', file));
                    continue; // Skip file if it already has vasm frontmatter
                }

                let alias = options.alias;

                if (!alias) {
                    const pathSegments = absolutePath.split(path.sep).filter(Boolean);
                    let basename = pathSegments[pathSegments.length - 1];
                    basename = basename.split('.')[0] || basename;

                    const genericNames = [
                        'readme', 'index', 'main', 'default', 'master', 'refs', 'heads', 'tree', 'blob', 'base', 'about', 'info', 'doc', 'docs',
                        'src', 'lib', 'pkg', 'bin', 'scripts', 'dist', 'build',
                        'prompt', 'prompts', 'system', 'user', 'assistant', 'template', 'instructions', 'rules',
                        'config', 'settings'
                    ];

                    let foundAlias = false;
                    for (let i = pathSegments.length - 1; i >= 0; i--) {
                        let segment = pathSegments[i];
                        if (i === pathSegments.length - 1) {
                            segment = segment.split('.')[0] || segment;
                        }
                        if (!genericNames.includes(segment.toLowerCase())) {
                            alias = segment.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                            foundAlias = true;
                            break;
                        }
                    }

                    if (!foundAlias) {
                        alias = basename.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'unnamed-module';
                    }
                }

                // Determine compile format: explicit flag > heuristic from filename
                const docFilenamePattern = /^(readme|help|design|changelog|contributing|license|docs?|guide|tutorial|manual|api)/i;
                const isLikelyDoc = docFilenamePattern.test(path.basename(file).split('.')[0]);
                const defaultFormat: CompileFormat = isLikelyDoc ? 'informational' : 'executable';
                let compileFormat: CompileFormat;
                try {
                    compileFormat = normalizeCliCompileFormat(options.format, file, defaultFormat);
                } catch (e: any) {
                    console.error(e.message);
                    process.exit(1);
                }

                // Detect source language for targetLangs default. If inference is weak,
                // leave targetLangs unset so users can make the declaration explicitly.
                const detectedLang = options.lang || detectLanguage(parsed.content);

                const vasmMetadata: Record<string, any> = {
                    alias: alias,
                    version: "1.0.0",
                    compile: {
                        format: compileFormat,
                    },
                };
                if (detectedLang) {
                    vasmMetadata.compile.targetLangs = [detectedLang];
                } else {
                    console.warn(t('LANG_DETECT_UNCERTAIN', file));
                }
                parsed.data.vasm = vasmMetadata;

                if (!options.format && isLikelyDoc) {
                    console.log(`[SEAL] 📄 Detected doc-like filename, using format: informational (override with --format executable)`);
                }

                // ----- Cross-compilation Language Auto-wrapping -----
                let content = parsed.content;
                if (!content.includes('<!-- lang:')) {
                    const targetLang = detectedLang;
                    if (targetLang) {
                        content = `\n<!-- lang:${targetLang} -->\n${content.trim()}\n<!-- /lang -->\n`;
                        console.log(t('SEAL_AUTO_WRAP', targetLang));
                    }
                }

                const newContent = stringifyFrontmatter(content, parsed.data);

                const dir = path.dirname(absolutePath);
                const originalBasename = path.basename(file).split('.')[0];
                const newFilename = `${originalBasename}.vasm.md`;
                const newAbsolutePath = path.resolve(dir, newFilename);

                fs.writeFileSync(newAbsolutePath, newContent, 'utf8');

                if (absolutePath !== newAbsolutePath) {
                    fs.unlinkSync(absolutePath);
                    console.log(t('SEAL_SUCCESS_RENAME', newFilename, alias as string));
                } else {
                    console.log(t('SEAL_SUCCESS_INJECT', file, alias as string));
                }
            }
        });

    program
        .command('sync')
        .alias('install')
        .description('Sync all dependencies from vasmc.yaml')
        .action(async () => {
            await syncDependencies();
        });

    program
        .command('update [alias]')
        .description('Force update dependencies, ignoring lockfile cache')
        .action(async (alias?: string) => {
            const lock = loadLockfile();
            lock.dependencies = lock.dependencies || {};

            if (alias) {
                if (lock.dependencies[alias]) {
                    delete lock.dependencies[alias];
                    console.log(t('UPDATE_CLEARED_ALIAS', alias));
                } else {
                    console.warn(t('UPDATE_WARN_NOT_FOUND', alias));
                }
            } else {
                lock.dependencies = {};
                console.log(t('UPDATE_CLEARED_ALL'));
            }

            saveLockfile(lock);
            await syncDependencies();
        });

    program
        .command('expand <entry>')
        .description('Expand a VASM source without workspace routing, build-state, or build report')
        .option('--target-lang <lang>', 'Filter language blocks to one target language')
        .option('--stdout', 'Write expanded Markdown to stdout (default)')
        .option('-o, --output <file>', 'Write expanded Markdown to a file')
        .action(async (entry: string, options?: { targetLang?: string; stdout?: boolean; output?: string }) => {
            if (options?.stdout && options.output) {
                console.error('Use either --stdout or --output, not both.');
                process.exit(1);
            }

            const absoluteFile = path.resolve(process.cwd(), entry);
            if (!fs.existsSync(absoluteFile)) {
                console.error(t('BUILD_ERR_ENTRY_NOT_FOUND', absoluteFile));
                process.exit(1);
            }

            const outputPath = options?.output ? path.resolve(process.cwd(), options.output) : undefined;
            const toStdout = options?.stdout || !outputPath;
            const originalLog = console.log;
            if (toStdout) {
                console.log = (...args: unknown[]) => console.error(...args);
            }

            try {
                const expanded = await compileFile(absoluteFile, outputPath, new Set(), options?.targetLang, true);
                if (outputPath) {
                    const dir = path.dirname(outputPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(outputPath, expanded, 'utf8');
                    console.log(`[EXPAND] Wrote ${path.relative(process.cwd(), outputPath)}`);
                } else {
                    process.stdout.write(expanded);
                }
            } catch (e: any) {
                console.error(t('BUILD_ERR_SINGLE', entry, e.message));
                process.exit(1);
            } finally {
                console.log = originalLog;
            }
        });

    if (buildMode === 'deterministic') {
        program
            .command('build [entry]')
            .description('Compile a specific file or run workspace build via vasmc-build.yaml')
            .option('-o, --out-dir <dir>', 'Specify output directory (works for both single file and workspace)')
            .option('--base-dir <dir>', 'Specify base directory for workspace compilation (strips this path when outputting)')
            .option('--target-langs <langs>', 'Comma-separated list of target languages for cross-compilation')
            .option('--force', 'Ignore build-state and rebuild unchanged entries')
            .option('--dry-run', 'Plan the build without writing outputs or build-state')
            .option('--plan', 'Alias for --dry-run')
            .action(async (entry?: string, options?: { outDir?: string; baseDir?: string; targetLangs?: string; force?: boolean; dryRun?: boolean; plan?: boolean }) => {
            const targetLangsArray = options?.targetLangs ? options.targetLangs.split(',').map(s => s.trim()) : undefined;
            const dryRun = options?.dryRun || options?.plan;
            if (entry) {
                try {
                    const workspaceEntry = await resolveSingleWorkspaceEntry(process.cwd(), entry, {
                        baseDir: options?.baseDir,
                        outDir: options?.outDir,
                        targetLangs: targetLangsArray,
                        force: options?.force,
                        dryRun,
                    });
                    if (dryRun) {
                        const plannedTarget = path.relative(process.cwd(), workspaceEntry.finalDest);
                        console.log(`[BUILD] 🧪 Planned: ${workspaceEntry.relativeFile} -> ${plannedTarget}`);
                        return;
                    }
                    await compileEntry(workspaceEntry, process.cwd(), false);
                } catch (e: any) {
                    console.error(t('BUILD_ERR_SINGLE', entry, e.message));
                    process.exit(1);
                }
            } else {
                // Run workspace build
                await runWorkspaceBuild(process.cwd(), { baseDir: options?.baseDir, outDir: options?.outDir, targetLangs: targetLangsArray, force: options?.force, dryRun });
            }
            });
    }

    // ===== AI Build Tool =====

    if (buildMode === 'ai' || includeAgent) {
        const aiBuildCommand = buildMode === 'ai' ? 'build [entry]' : 'agent [entry]';
        const aiBuildDescription = buildMode === 'ai'
            ? 'Build for AI editors: deterministic AST assembly + structured build report'
            : 'Compile for AI editors: deterministic AST assembly + structured build report';
        program
            .command(aiBuildCommand)
            .description(aiBuildDescription)
            .option('-o, --out-dir <dir>', 'Specify output directory')
            .option('--base-dir <dir>', 'Specify base directory for workspace compilation')
            .option('--target-langs <langs>', 'Comma-separated list of target languages for cross-compilation')
            .option('--force', 'Ignore build-state and rebuild unchanged entries')
            .option('--dry-run', 'Plan the build without writing outputs, build-state, or the default report')
            .option('--plan', 'Alias for --dry-run')
            .option('--report-out <file>', 'Write build report to this path instead of the default report path')
            .action(async (entry?: string, options?: { outDir?: string; baseDir?: string; targetLangs?: string; force?: boolean; dryRun?: boolean; plan?: boolean; reportOut?: string }) => {
            const targetLangsArray = options?.targetLangs ? options.targetLangs.split(',').map(s => s.trim()) : undefined;
            const buildOptions = {
                baseDir: options?.baseDir,
                outDir: options?.outDir,
                targetLangs: targetLangsArray,
                force: options?.force,
                dryRun: options?.dryRun || options?.plan,
                reportOut: options?.reportOut,
            };
            if (entry) {
                try {
                    await runAIBuildEntry(process.cwd(), entry, buildOptions);
                } catch (e: any) {
                    console.error(t('BUILD_ERR_SINGLE', entry, e.message));
                    process.exit(1);
                }
            } else {
                // Run workspace build in AI build mode
                await runAIBuild(process.cwd(), buildOptions);
            }
            });
    }

    program
        .command('graph <entry>')
        .description(t('CLI_DESC_GRAPH'))
        .action(async (entry) => {
            try {
                if (!entry) {
                    console.error(t('BUILD_ERR_ENTRY_NOT_FOUND', 'undefined'));
                    process.exit(1);
                }
                await generateGraph(entry, process.cwd());
            } catch (err: any) {
                console.error(t('BUILD_ERR_WORKSPACE', entry, 'graph', err.message));
                process.exit(1);
            }
        });

    return program;
}
