import { Command } from 'commander';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import { syncDependencies } from './sync';
import { loadConfig, saveConfig, loadLockfile, saveLockfile, loadBuildConfig } from './config';
import { runWorkspaceBuild, runAgentBuild } from './build';
import { compileFile, extractTargetLangs } from './compiler';
import { detectLanguage, estimateTokens } from './utils';
import { fetchMarkdown } from './network';
import matter from 'gray-matter';
import { verifyCompiledContent } from './verify';
import * as path from 'path';
import * as fs from 'fs';
import { initI18n, t } from './i18n';
import { generateGraph } from './graph';
import type { LyncFrontmatter } from './types';
import * as yaml from 'yaml';
import { mergeCompiledLangs } from './merge';

export function setupCLI(): Command {
    const program = new Command();

    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

    program
        .name('lync')
        .description('A decentralized markdown package manager and compiler.')
        .version(pkg.version || '0.1.0')
        .option('--lang <lang>', 'Global language for CLI interactive outputs (e.g. en, zh-CN)')
        .hook('preAction', (thisCommand) => {
            initI18n(thisCommand.opts().lang);
        });

    program
        .command('init')
        .description('Initialize a default lync-build.yaml configuration file')
        .action(() => {
            const configPath = path.resolve(process.cwd(), 'lync-build.yaml');
            if (fs.existsSync(configPath)) {
                console.log(t('INIT_WARN_EXISTS'));
                return;
            }

            const defaultConfig = `# Lync Build Configuration
# Determines how the Lync compiler will assemble and output your Markdown modules.

# The entry files to compile
includes:
  - "**/*.lync.md"

# The output destination directory
output:
  dir: "./dist"
  # flat: true # Uncomment to ignore baseDir hierarchy and compile everything directly into dir
  # inPlace: true # Uncomment to compile files directly alongside their source (e.g., a/prompt.lync.md -> a/prompt.md)

# Strip this prefix directory from the original paths
baseDir: "."

# Cross-compilation targets per output format (optional)
# By default, Lync infers languages automatically from <!-- lang:xxx --> blocks in your source.
# Uncomment below to force explicit language generation:
# compile:
#   doc:                          # Document format: multi-language merge into one file
#     targetLangs: ["en", "zh-CN"]
#   exec:                         # Executable prompt format: one file per language
#     targetLangs: ["en"]

# Advanced Routing Interceptors (optional)
# routing:
#   - match: "src/agents/*.lync.md"
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
                    const parsed = matter(content);

                    if (parsed.data.lync && parsed.data.lync.alias) {
                        alias = parsed.data.lync.alias;
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
        .description('Convert standard markdown files into Lync modules by injecting Frontmatter. Supports wildcards.')
        .option('--alias <alias>', 'Explicitly set the alias name (only recommended for single files)')
        .option('--lang <lang>', 'Wrap content in a specific language block (e.g. ja, zh-CN)')
        .action(async (patterns: string[], options: { alias?: string; lang?: string }) => {
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
                const parsed = matter(rawContent);

                if (parsed.data.lync) {
                    console.warn(t('SEAL_WARN_EXISTS', file));
                    continue; // Skip file if it already has lync frontmatter
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

                const lyncMetadata = {
                    alias: alias,
                    version: "1.0.0"
                };
                parsed.data.lync = lyncMetadata;

                // ----- Cross-compilation Language Auto-wrapping -----
                let content = parsed.content;
                if (!content.includes('<!-- lang:')) {
                    const targetLang = options.lang || detectLanguage(content);
                    if (targetLang) {
                        content = `\n<!-- lang:${targetLang} -->\n${content.trim()}\n<!-- /lang -->\n`;
                        console.log(t('SEAL_AUTO_WRAP', targetLang));
                    }
                }

                const newContent = matter.stringify(content, parsed.data);

                const dir = path.dirname(absolutePath);
                const originalBasename = path.basename(file).split('.')[0];
                const newFilename = `${originalBasename}.lync.md`;
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
        .description('Sync all dependencies from lync.yaml')
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
        .command('build [entry]')
        .description('Compile a specific file or run workspace build via lync-build.yaml')
        .option('-o, --out-dir <dir>', 'Specify output directory (works for both single file and workspace)')
        .option('--base-dir <dir>', 'Specify base directory for workspace compilation (strips this path when outputting)')
        .option('--target-langs <langs>', 'Comma-separated list of target languages for cross-compilation')
        .action(async (entry?: string, options?: { outDir?: string; baseDir?: string; targetLangs?: string }) => {
            const targetLangsArray = options?.targetLangs ? options.targetLangs.split(',').map(s => s.trim()) : undefined;
            if (entry) {
                // Compile single file
                const absoluteEntry = path.resolve(process.cwd(), entry);
                if (!fs.existsSync(absoluteEntry)) {
                    console.error(t('BUILD_ERR_ENTRY_NOT_FOUND', absoluteEntry));
                    process.exit(1);
                }

                const buildConfig = loadBuildConfig(process.cwd());
                const configuredOutDir = options?.outDir || buildConfig.output?.dir;
                let finalDest;
                if (configuredOutDir) {
                    const outName = path.basename(entry).replace(/\.lync\.md$/, '.md');
                    finalDest = path.resolve(process.cwd(), configuredOutDir, outName);
                } else {
                    finalDest = absoluteEntry.replace(/\.lync\.md$/, '.md');
                    if (finalDest === absoluteEntry) {
                        finalDest = finalDest + '.compiled.md';
                    }
                }

                // Apply routing interceptors (same logic as workspace build)
                if (buildConfig.routing && buildConfig.routing.length > 0) {
                    for (const rule of buildConfig.routing) {
                        if (minimatch(entry, rule.match, { matchBase: true })) {
                            const destBase = path.resolve(process.cwd(), rule.dest);
                            if (!path.extname(destBase)) {
                                const basename = path.basename(entry).replace(/\.lync\.md$/, '.md');
                                finalDest = path.join(destBase, basename);
                            } else {
                                finalDest = destBase;
                            }
                            break;
                        }
                    }
                }

                try {
                    let fileLangsToProcess: string[] | undefined;

                    // 1. Determine compile format from frontmatter (default: exec)
                    let compileFormat: 'doc' | 'prompt' = 'prompt';
                    let frontmatterTargetLangs: string[] | undefined;
                    const rawSourceContent = fs.readFileSync(absoluteEntry, 'utf8');
                    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(rawSourceContent);
                    if (fmMatch) {
                        try {
                            const fm = yaml.parse(fmMatch[1]) as LyncFrontmatter;
                            if (fm?.lync?.compile?.format) {
                                compileFormat = fm.lync.compile.format;
                            }
                            if (fm?.lync?.compile?.targetLangs) {
                                frontmatterTargetLangs = fm.lync.compile.targetLangs;
                            }
                        } catch (e) { }
                    }

                    // 2. Resolve targetLangs: frontmatter > per-format global > CLI > legacy global > extract
                    if (frontmatterTargetLangs && frontmatterTargetLangs.length > 0) {
                        fileLangsToProcess = frontmatterTargetLangs;
                    } else if (compileFormat === 'doc' && buildConfig.compile?.doc?.targetLangs?.length) {
                        fileLangsToProcess = buildConfig.compile.doc.targetLangs;
                    } else if (compileFormat === 'prompt' && buildConfig.compile?.prompt?.targetLangs?.length) {
                        fileLangsToProcess = buildConfig.compile.prompt.targetLangs;
                    } else if (targetLangsArray && targetLangsArray.length > 0) {
                        fileLangsToProcess = targetLangsArray;
                    } else {
                        const extracted = extractTargetLangs(absoluteEntry);
                        fileLangsToProcess = extracted.length > 0 ? extracted : [undefined] as any;
                    }

                    const isDocFormat = compileFormat === 'doc' && fileLangsToProcess!;
                    const compiledMap = new Map<string, string>();

                    for (const targetLang of fileLangsToProcess!) {
                        let currentDest = finalDest;
                        if (!isDocFormat && targetLang && targetLang !== 'auto' && fileLangsToProcess!.length > 1) {
                            currentDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                        }

                        const content = await compileFile(absoluteEntry, currentDest, new Set(), targetLang);
                        compiledMap.set(targetLang || 'auto', content);

                        if (!isDocFormat) {
                            const dir = path.dirname(currentDest);
                            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                            fs.writeFileSync(currentDest, content, 'utf8');
                            console.log(t('BUILD_SUCCESS_SINGLE', entry, targetLang ? `[${targetLang}]` : '', path.relative(process.cwd(), currentDest)));
                        }
                    }

                    if (isDocFormat) {
                        try {
                            const dir = path.dirname(finalDest);
                            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                            console.log(`[MERGE] 🪄 Merging ${compiledMap.size} languages into ${path.relative(process.cwd(), finalDest)}...`);
                            const mergedContent = mergeCompiledLangs(compiledMap);
                            fs.writeFileSync(finalDest, mergedContent, 'utf8');
                            console.log(t('BUILD_SUCCESS_SINGLE', entry, '[merged]', path.relative(process.cwd(), finalDest)));
                        } catch (e: any) {
                            console.error(`[MERGE_ERR] ❌ Failed to merge ${entry}: ${e.message}`);
                        }
                    }
                } catch (e: any) {
                    console.error(t('BUILD_ERR_SINGLE', entry, e.message));
                    process.exit(1);
                }
            } else {
                // Run workspace build
                await runWorkspaceBuild(process.cwd(), { baseDir: options?.baseDir, outDir: options?.outDir, targetLangs: targetLangsArray });
            }
        });

    // ===== LLM Enhanced Tools =====

    program
        .command('lint <file>')
        .description('Run LLM-powered semantic linting on a compiled markdown file')
        .option('--model <model>', 'Specify the LLM model to use (default: gpt-4o)')
        .option('--continue-on-error', 'Exit with 0 even if the LLM API call fails')
        .action(async (file: string, options?: { model?: string; continueOnError?: boolean }) => {
            const absoluteFile = path.resolve(process.cwd(), file);
            if (!fs.existsSync(absoluteFile)) {
                console.error(`[LINT] ❌ File not found: ${absoluteFile}`);
                process.exit(1);
            }
            const content = fs.readFileSync(absoluteFile, 'utf8');
            console.log(`[LINT] 🔍 Running semantic linting on ${file}...`);
            const verified = await verifyCompiledContent(content, options?.model);
            if (!verified.passed) {
                if (verified.error && options?.continueOnError) {
                    console.log(t('LINT_ERR_CONTINUE'));
                } else {
                    process.exit(1);
                }
            }
        });

    program
        .command('diff <file> [old-file]')
        .description('Analyze semantic differences between compiled outputs using an LLM')
        .option('--model <model>', 'Specify the LLM model to use (default: gpt-4o)')
        .action(async (file: string, oldFile?: string, options?: { model?: string }) => {
            const absoluteFile = path.resolve(process.cwd(), file);
            if (!fs.existsSync(absoluteFile)) {
                console.error(`[DIFF] ❌ File not found: ${absoluteFile}`);
                process.exit(1);
            }
            const newContent = fs.readFileSync(absoluteFile, 'utf8');
            let oldContent = '';
            if (oldFile) {
                const absoluteOld = path.resolve(process.cwd(), oldFile);
                if (!fs.existsSync(absoluteOld)) {
                    console.error(`[DIFF] ❌ Old file not found: ${absoluteOld}`);
                    process.exit(1);
                }
                oldContent = fs.readFileSync(absoluteOld, 'utf8');
            }
            if (oldContent === newContent) {
                console.log(`[DIFF] ✅ Files are identical. No semantic differences.`);
                return;
            }
            const { analyzeSemanticDiff } = await import('./verify');
            await analyzeSemanticDiff(oldContent, newContent, options?.model);
        });

    // ===== Agent Tool =====

    program
        .command('agent [entry]')
        .description('Compile for AI editors: deterministic AST assembly + output agent-instructions.md')
        .option('-o, --out-dir <dir>', 'Specify output directory')
        .option('--base-dir <dir>', 'Specify base directory for workspace compilation')
        .option('--target-langs <langs>', 'Comma-separated list of target languages for cross-compilation')
        .action(async (entry?: string, options?: { outDir?: string; baseDir?: string; targetLangs?: string }) => {
            const targetLangsArray = options?.targetLangs ? options.targetLangs.split(',').map(s => s.trim()) : undefined;
            if (entry) {
                const absoluteEntry = path.resolve(process.cwd(), entry);
                if (!fs.existsSync(absoluteEntry)) {
                    console.error(t('BUILD_ERR_ENTRY_NOT_FOUND', absoluteEntry));
                    process.exit(1);
                }

                const buildConfig = loadBuildConfig(process.cwd());
                const configuredOutDir = options?.outDir || buildConfig.output?.dir;
                let finalDest;
                if (configuredOutDir) {
                    const outName = path.basename(entry).replace(/\.lync\.md$/, '.md');
                    finalDest = path.resolve(process.cwd(), configuredOutDir, outName);
                } else {
                    finalDest = absoluteEntry.replace(/\.lync\.md$/, '.md');
                    if (finalDest === absoluteEntry) {
                        finalDest = finalDest + '.compiled.md';
                    }
                }

                // Apply routing interceptors (same logic as workspace build)
                if (buildConfig.routing && buildConfig.routing.length > 0) {
                    for (const rule of buildConfig.routing) {
                        if (minimatch(entry, rule.match, { matchBase: true })) {
                            const destBase = path.resolve(process.cwd(), rule.dest);
                            if (!path.extname(destBase)) {
                                const basename = path.basename(entry).replace(/\.lync\.md$/, '.md');
                                finalDest = path.join(destBase, basename);
                            } else {
                                finalDest = destBase;
                            }
                            break;
                        }
                    }
                }

                try {
                    let fileLangsToProcess: string[] | undefined;
                    let compileFormat: 'doc' | 'prompt' = 'prompt';
                    let frontmatterTargetLangs: string[] | undefined;
                    let vision: string | undefined;
                    let fixMode: 'suggest' | 'auto' = 'suggest';
                    const rawSourceContent = fs.readFileSync(absoluteEntry, 'utf8');
                    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(rawSourceContent);
                    if (fmMatch) {
                        try {
                            const fm = yaml.parse(fmMatch[1]) as LyncFrontmatter;
                            if (fm?.lync?.compile?.format) compileFormat = fm.lync.compile.format;
                            if (fm?.lync?.compile?.targetLangs) frontmatterTargetLangs = fm.lync.compile.targetLangs;
                            if (fm?.lync?.vision) vision = fm.lync.vision.trim();
                            if (fm?.lync?.fix) fixMode = fm.lync.fix;
                        } catch (e) { }
                    }

                    if (frontmatterTargetLangs && frontmatterTargetLangs.length > 0) {
                        fileLangsToProcess = frontmatterTargetLangs;
                    } else if (compileFormat === 'doc' && buildConfig.compile?.doc?.targetLangs?.length) {
                        fileLangsToProcess = buildConfig.compile.doc.targetLangs;
                    } else if (compileFormat === 'prompt' && buildConfig.compile?.prompt?.targetLangs?.length) {
                        fileLangsToProcess = buildConfig.compile.prompt.targetLangs;
                    } else if (targetLangsArray && targetLangsArray.length > 0) {
                        fileLangsToProcess = targetLangsArray;
                    } else {
                        const extracted = extractTargetLangs(absoluteEntry);
                        fileLangsToProcess = extracted.length > 0 ? extracted : [undefined] as any;
                    }

                    const isDocFormat = compileFormat === 'doc' && fileLangsToProcess!;
                    const compiledMap = new Map<string, string>();
                    let minTokens = Infinity;
                    let bestLang = 'auto';
                    const agentHistoryPaths: { lang: string; backupPath: string }[] = [];

                    for (const targetLang of fileLangsToProcess!) {
                        let currentDest = finalDest;
                        if (!isDocFormat && targetLang && targetLang !== 'auto' && fileLangsToProcess!.length > 1) {
                            currentDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                        }

                        // Cache old content for agent diff
                        if (fs.existsSync(currentDest) && !isDocFormat) {
                            const oldContent = fs.readFileSync(currentDest, 'utf8');
                            const cacheDir = path.resolve(process.cwd(), '.lync', 'cache');
                            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                            const timestamp = new Date().getTime();
                            const oldContentPath = path.resolve(cacheDir, `history-${timestamp}-${path.basename(currentDest)}`);
                            fs.writeFileSync(oldContentPath, oldContent, 'utf8');
                            agentHistoryPaths.push({ lang: targetLang || 'auto', backupPath: oldContentPath });
                        }

                        // Agent mode: zero LLM, pure AST assembly
                        const content = await compileFile(absoluteEntry, currentDest, new Set(), targetLang, true);
                        compiledMap.set(targetLang || 'auto', content);

                        if (!isDocFormat) {
                            const dir = path.dirname(currentDest);
                            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                            fs.writeFileSync(currentDest, content, 'utf8');
                            console.log(t('BUILD_SUCCESS_SINGLE', entry, targetLang ? `[${targetLang}]` : '', path.relative(process.cwd(), currentDest)));
                        }

                        const tokens = estimateTokens(content);
                        if (tokens < minTokens) {
                            minTokens = tokens;
                            bestLang = targetLang || 'auto';
                        }
                    }

                    if (isDocFormat) {
                        try {
                            const dir = path.dirname(finalDest);
                            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                            console.log(`[MERGE] 🪄 Merging ${compiledMap.size} languages into ${path.relative(process.cwd(), finalDest)}...`);
                            const mergedContent = mergeCompiledLangs(compiledMap);
                            fs.writeFileSync(finalDest, mergedContent, 'utf8');
                            console.log(t('BUILD_SUCCESS_SINGLE', entry, '[merged]', path.relative(process.cwd(), finalDest)));
                        } catch (e: any) {
                            console.error(`[MERGE_ERR] ❌ Failed to merge ${entry}: ${e.message}`);
                        }
                    }

                    // Output agent instructions
                    const instructionsPath = path.resolve(process.cwd(), '.lync', 'agent-instructions.md');
                    const instructionsDir = path.dirname(instructionsPath);
                    if (!fs.existsSync(instructionsDir)) fs.mkdirSync(instructionsDir, { recursive: true });

                    const needsLangSuffix = !isDocFormat && fileLangsToProcess!.length > 1;
                    const minVariantPath = path.relative(process.cwd(), finalDest.replace(/\.md$/, needsLangSuffix && bestLang !== 'auto' ? `.${bestLang}.md` : '.md'));
                    const langsNeedingTranslation = fileLangsToProcess!.filter(l => (l || 'auto') !== bestLang && l !== 'auto');

                    const actionItems: string[] = [];
                    let itemIndex = 1;


                    // 1. Verify (exec only)
                    if (!isDocFormat) {
                        const verifyLabel = vision
                            ? (fixMode === 'auto'
                                ? `**Verify & Auto-Fix** \`${minVariantPath}\` — check against vision + 4 criteria; directly edit product to fix any issues`
                                : `**Verify** \`${minVariantPath}\` — check against vision + 4 criteria; if issues found, output suggested edits (do NOT modify product)`)
                            : `**Verify** \`${minVariantPath}\``;
                        actionItems.push(`${itemIndex++}. ${verifyLabel}`);
                    }

                    // 2. Translation (only if needed)
                    if (langsNeedingTranslation.length > 0) {
                        const targetFiles = langsNeedingTranslation
                            .map(l => `\`${path.relative(process.cwd(), finalDest.replace(/\.md$/, `.${l}.md`))}\``)
                            .join(', ');
                        actionItems.push(`${itemIndex++}. **Translate** \`${minVariantPath}\` → ${targetFiles}`);
                    }

                    // 3. Diff (only if backup exists)
                    if (agentHistoryPaths.length > 0) {
                        const backupList = agentHistoryPaths.map(h => `\`${path.relative(process.cwd(), h.backupPath)}\` (${h.lang})`).join(', ');
                        actionItems.push(`${itemIndex++}. **Diff** against ${backupList}`);
                    }

                    // 4. Tree-Shake (conditional, exec only)
                    if (!isDocFormat) {
                        actionItems.push(`${itemIndex++}. **Tree-Shake** \`${minVariantPath}\` *(conditional — only if user requested optimization)*`);
                    }

                    const compiledFilesYaml = fileLangsToProcess!
                        .map(lang => `  - ${path.relative(process.cwd(), finalDest.replace(/\.md$/, (!isDocFormat && fileLangsToProcess!.length > 1 && lang !== 'auto' && lang) ? `.${lang}.md` : '.md'))}`)
                        .join('\n');

                    const visionLines = vision
                        ? [`**Vision:** ${vision.replace(/\n/g, ' ')}`, `**Fix Mode:** ${fixMode}`, ``]
                        : [];

                    const instructions = [
                        `# Lync Agent Instructions — \`${entry}\``,
                        ``,
                        `**Minimal-Token Variant:** ${minVariantPath} (${minTokens} tokens)`,
                        `**Target Languages:** ${fileLangsToProcess!.join(', ')}`,
                        ...visionLines,
                        '```yaml',
                        `compiledFiles:`,
                        compiledFilesYaml,
                        '```',
                        ``,
                        `## 🛠️ Action Items`,
                        ``,
                        actionItems.join('\n\n'),
                    ].join('\n');

                    fs.writeFileSync(instructionsPath, instructions, 'utf8');
                    console.log(`\n[AGENT] 🤖 Orchestration instructions generated: ${path.relative(process.cwd(), instructionsPath)}`);

                } catch (e: any) {
                    console.error(t('BUILD_ERR_SINGLE', entry, e.message));
                    process.exit(1);
                }
            } else {
                // Run workspace build in agent mode
                await runAgentBuild(process.cwd(), { baseDir: options?.baseDir, outDir: options?.outDir, targetLangs: targetLangsArray });
            }
        });

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
