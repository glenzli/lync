import { Command } from 'commander';
import { syncDependencies } from './sync';
import { loadConfig, saveConfig, loadLockfile, saveLockfile } from './config';
import { runWorkspaceBuild } from './build';
import { compileFile } from './compiler';
import * as path from 'path';
import * as fs from 'fs';

export function setupCLI(): Command {
    const program = new Command();

    program
        .name('lync')
        .description('A decentralized markdown package manager and compiler.')
        .version('0.1.0');

    program
        .command('add <url>')
        .description('Add a remote dependency')
        .option('--alias <alias>', 'Explicitly set the alias name')
        .option('--dest <dest>', 'Explicitly set local destination path')
        .action(async (url: string, options: { alias?: string; dest?: string }) => {
            const config = loadConfig();
            config.dependencies = config.dependencies || {};

            let alias = options.alias;

            // 1. Filename Inference
            if (!alias) {
                try {
                    const urlObj = new URL(url);
                    const pathname = urlObj.pathname;
                    const basename = pathname.split('/').pop() || 'unnamed-dep';
                    alias = basename.replace(/\.[^/.]+$/, ""); // strip extension
                } catch (e) {
                    alias = 'unnamed-dep';
                }
            }

            // 2. Collision Resolution
            let finalAlias = alias;
            let counter = 1;
            while (config.dependencies[finalAlias]) {
                // Checking if URL already matches exactly, safe to override
                const existingDecl = config.dependencies[finalAlias];
                const existingUrl = typeof existingDecl === 'string' ? existingDecl : existingDecl.url;

                if (existingUrl === url) {
                    break;
                }

                finalAlias = `${alias}-${counter}`;
                counter++;
            }

            // Add to config
            if (options.dest) {
                config.dependencies[finalAlias] = { url, dest: options.dest };
            } else {
                config.dependencies[finalAlias] = url; // simplified string declaration
            }

            saveConfig(config);
            console.log(`[CLI] Added alias '${finalAlias}' pointing to ${url}`);

            // Auto-sync afterwards
            await syncDependencies();
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
        .option('-o, --out-dir <dir>', 'Specify output directory for single file entry')
        .action(async (entry?: string, options?: { outDir?: string }) => {
            if (entry) {
                // Compile single file
                const absoluteEntry = path.resolve(process.cwd(), entry);
                if (!fs.existsSync(absoluteEntry)) {
                    console.error(`[ERROR] Entry file not found: ${absoluteEntry}`);
                    process.exit(1);
                }

                let finalDest;
                if (options && options.outDir) {
                    const outName = path.basename(entry).replace(/\.src\.md$/, '.md');
                    finalDest = path.resolve(process.cwd(), options.outDir, outName);
                } else {
                    finalDest = absoluteEntry.replace(/\.src\.md$/, '.md');
                    if (finalDest === absoluteEntry) {
                        finalDest = finalDest + '.compiled.md'; // Fallback to avoid destroying entry
                    }
                }

                try {
                    const content = await compileFile(absoluteEntry, finalDest);
                    const dir = path.dirname(finalDest);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(finalDest, content, 'utf8');
                    console.log(`[BUILD] ✅ Compiled ${entry} -> ${path.relative(process.cwd(), finalDest)}`);
                } catch (e: any) {
                    console.error(`[BUILD] ❌ Failed to compile ${entry}: ${e.message}`);
                }
            } else {
                // Run workspace build
                await runWorkspaceBuild();
            }
        });

    return program;
}
