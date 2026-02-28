import { Command } from 'commander';
import { glob } from 'glob';
import { syncDependencies } from './sync';
import { loadConfig, saveConfig, loadLockfile, saveLockfile, loadBuildConfig } from './config';
import { runWorkspaceBuild } from './build';
import { compileFile, extractTargetLangs } from './compiler';
import { detectLanguage } from './utils';
import { fetchMarkdown } from './network';
import matter from 'gray-matter';
import { verifyCompiledContent } from './verify';
import * as path from 'path';
import * as fs from 'fs';

export function setupCLI(): Command {
    const program = new Command();

    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

    program
        .name('lync')
        .description('A decentralized markdown package manager and compiler.')
        .version(pkg.version || '0.1.0');

    program
        .command('init')
        .description('Initialize a default lync-build.yaml configuration file')
        .action(() => {
            const configPath = path.resolve(process.cwd(), 'lync-build.yaml');
            if (fs.existsSync(configPath)) {
                console.log(`[INIT] ⚠️ lync-build.yaml already exists in the current directory.`);
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

# Target languages for multi-language generation (optional)
# By default, Lync infers languages automatically from :::lang=xxx blocks in your source.
# Uncomment below to force explicit language generation for all matched files:
# targetLangs:
#  - "en"
#  - "zh-CN"

# Advanced Routing Interceptors (optional)
# routing:
#   - match: "src/agents/*.lync.md"
#     dest: "./dist/agents/"
`;
            fs.writeFileSync(configPath, defaultConfig, 'utf8');
            console.log(`[INIT] ✅ Successfully created lync-build.yaml!`);
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
                console.log(`[CLI] Fetching ${url} to inspect metadata...`);
                try {
                    const content = await fetchMarkdown(url);
                    const parsed = matter(content);

                    if (parsed.data.lync && parsed.data.lync.alias) {
                        alias = parsed.data.lync.alias;
                        console.log(`[CLI] Discovered declared alias from Frontmatter: '${alias}'`);
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
                                    console.log(`[CLI] Generic path detected. Traversed up to infer alias: '${alias}'`);
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
            console.log(`[CLI] Added alias '${finalAlias}' pointing to ${url}`);

            await syncDependencies();
        });

    program
        .command('seal [patterns...]')
        .description('Convert standard markdown files into Lync modules by injecting Frontmatter. Supports wildcards.')
        .option('--alias <alias>', 'Explicitly set the alias name (only recommended for single files)')
        .option('--lang <lang>', 'Wrap content in a specific i18n block (e.g. ja, zh-CN)')
        .action(async (patterns: string[], options: { alias?: string; lang?: string }) => {
            if (!patterns || patterns.length === 0) {
                console.error(`[ERROR] Please specify at least one file or pattern to seal.`);
                process.exit(1);
            }

            const matchedFiles = new Set<string>();
            for (const pattern of patterns) {
                const files = await glob(pattern, { cwd: process.cwd(), absolute: true });
                files.forEach(f => matchedFiles.add(f));
            }

            if (matchedFiles.size === 0) {
                console.error(`[ERROR] No files matched the given patterns.`);
                process.exit(1);
            }

            for (const absolutePath of matchedFiles) {
                if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;

                const file = path.relative(process.cwd(), absolutePath);
                const rawContent = fs.readFileSync(absolutePath, 'utf8');
                const parsed = matter(rawContent);

                if (parsed.data.lync) {
                    console.warn(`[WARN] File '${file}' already contains Lync Frontmatter.`);
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

                // ----- [NEW] i18n Auto-wrapping -----
                let content = parsed.content;
                if (!content.includes('<!-- lang:')) {
                    const targetLang = options.lang || detectLanguage(content);
                    if (targetLang) {
                        content = `\n<!-- lang:${targetLang} -->\n${content.trim()}\n<!-- /lang -->\n`;
                        console.log(`[CLI] 🌐 Auto-wrapped content in '${targetLang}' block.`);
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
                    console.log(`[CLI] 📦 Sealed module! Renamed to '${newFilename}' and injected Frontmatter (alias: '${alias}').`);
                } else {
                    console.log(`[CLI] 📦 Sealed module! Injected Frontmatter into '${file}' (alias: '${alias}').`);
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
                    console.log(`[CLI] Cleared lock cache for '${alias}'.`);
                } else {
                    console.warn(`[WARN] Alias '${alias}' not found in lockfile.`);
                }
            } else {
                lock.dependencies = {};
                console.log(`[CLI] Cleared locked cache for all dependencies.`);
            }

            saveLockfile(lock);
            await syncDependencies();
        });

    program
        .command('build [entry]')
        .description('Compile a specific file or run workspace build via lync-build.yaml')
        .option('-o, --out-dir <dir>', 'Specify output directory (works for both single file and workspace)')
        .option('--base-dir <dir>', 'Specify base directory for workspace compilation (strips this path when outputting)')
        .option('--target-langs <langs>', 'Comma-separated list of target languages for i18n compilation')
        .option('--verify', 'Perform native LLM semantic linting on the compiled markdown')
        .option('--model <model>', 'Specify the LLM model to use for verification (default: gpt-4o)')
        .action(async (entry?: string, options?: { outDir?: string; baseDir?: string; targetLangs?: string; verify?: boolean; model?: string }) => {
            const targetLangsArray = options?.targetLangs ? options.targetLangs.split(',').map(s => s.trim()) : undefined;
            if (entry) {
                // Compile single file
                const absoluteEntry = path.resolve(process.cwd(), entry);
                if (!fs.existsSync(absoluteEntry)) {
                    console.error(`[ERROR] Entry file not found: ${absoluteEntry}`);
                    process.exit(1);
                }

                const buildConfig = loadBuildConfig(process.cwd());
                const configuredOutDir = options?.outDir || buildConfig.outDir || buildConfig.output?.dir;
                let finalDest;
                if (configuredOutDir) {
                    const outName = path.basename(entry).replace(/\.lync\.md$/, '.md');
                    finalDest = path.resolve(process.cwd(), configuredOutDir, outName);
                } else {
                    finalDest = absoluteEntry.replace(/\.lync\.md$/, '.md');
                    if (finalDest === absoluteEntry) {
                        finalDest = finalDest + '.compiled.md'; // Fallback to avoid destroying entry
                    }
                }

                try {
                    let fileLangsToProcess = targetLangsArray && targetLangsArray.length > 0 ? targetLangsArray : undefined;
                    if (!fileLangsToProcess && buildConfig.targetLangs && buildConfig.targetLangs.length > 0) {
                        fileLangsToProcess = buildConfig.targetLangs;
                    }
                    if (!fileLangsToProcess) {
                        const extracted = extractTargetLangs(absoluteEntry);
                        fileLangsToProcess = extracted.length > 0 ? extracted : [undefined] as any;
                    }

                    for (const targetLang of fileLangsToProcess!) {
                        let currentDest = finalDest;
                        if (targetLang) {
                            currentDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                        }

                        const content = await compileFile(absoluteEntry, currentDest, new Set(), targetLang);
                        const dir = path.dirname(currentDest);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(currentDest, content, 'utf8');
                        console.log(`[BUILD] ✅ Compiled ${entry} ${targetLang ? `[${targetLang}]` : ''} -> ${path.relative(process.cwd(), currentDest)}`);

                        if (options && options.verify) {
                            const verified = await verifyCompiledContent(content, options.model);
                            if (!verified) {
                                process.exit(1);
                            }
                        }
                    }
                } catch (e: any) {
                    console.error(`[BUILD] ❌ Failed to compile ${entry}: ${e.message}`);
                }
            } else {
                // Run workspace build
                await runWorkspaceBuild(process.cwd(), options?.verify, options?.model, { baseDir: options?.baseDir, outDir: options?.outDir, targetLangs: targetLangsArray });
            }
        });

    return program;
}
