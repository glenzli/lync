import { glob } from 'glob';
import { minimatch } from 'minimatch';
import * as path from 'path';
import * as fs from 'fs';
import { loadBuildConfig } from './config';
import { compileFile, extractTargetLangs } from './compiler';
import { verifyCompiledContent } from './verify';

export async function runWorkspaceBuild(cwd: string = process.cwd(), verify?: boolean, model?: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[] }) {
    const buildConfig = loadBuildConfig(cwd);

    const includes = buildConfig.includes && buildConfig.includes.length > 0
        ? buildConfig.includes
        : ['**/*.lync.md'];

    const configuredOutDir = cliOptions?.outDir || buildConfig.outDir || buildConfig.output?.dir || './dist';
    const finalOutDir = path.resolve(cwd, configuredOutDir);
    const finalBaseDir = path.resolve(cwd, cliOptions?.baseDir || buildConfig.baseDir || '.');

    let globalTargetLangs = cliOptions?.targetLangs;
    if (!globalTargetLangs || globalTargetLangs.length === 0) {
        globalTargetLangs = buildConfig.targetLangs;
    }

    // Find all entry files
    const files = await glob(includes, {
        cwd: cwd,
        ignore: ['node_modules/**', '.lync/**', 'dist/**']
    });

    if (files.length === 0) {
        console.log(`[BUILD] No source files found matching patterns: ${includes.join(', ')}`);
        return;
    }

    for (const relativeFile of files) {
        const absoluteFile = path.resolve(cwd, relativeFile);

        let finalDest;

        if (buildConfig.output?.inPlace && !cliOptions?.outDir) {
            // Compile alongside the source file
            finalDest = path.join(path.dirname(absoluteFile), path.basename(absoluteFile).replace(/\.lync\.md$/, '.md'));
        } else {
            let relativeToBase = path.relative(finalBaseDir, absoluteFile);
            if (buildConfig.output?.flat || relativeToBase.startsWith('..' + path.sep) || relativeToBase === '..') {
                // If the file is strictly outside baseDir or flatten is enabled, fallback to its basename
                relativeToBase = path.basename(absoluteFile);
            }
            finalDest = path.resolve(finalOutDir, relativeToBase.replace(/\.lync\.md$/, '.md'));
        }

        // Apply routing interceptors
        if (buildConfig.routing && buildConfig.routing.length > 0) {
            for (const rule of buildConfig.routing) {
                if (minimatch(relativeFile, rule.match, { matchBase: true })) {
                    // Rule matched. Let's decide how to construct the dest.
                    const destBase = path.resolve(cwd, rule.dest);
                    if (!path.extname(destBase)) {
                        // It's a directory
                        const basename = path.basename(relativeFile).replace(/\.lync\.md$/, '.md');
                        finalDest = path.join(destBase, basename);
                    } else {
                        // It's an exact file
                        finalDest = destBase;
                    }
                    break; // Stop at first routing match
                }
            }
        }

        let fileLangsToProcess = globalTargetLangs && globalTargetLangs.length > 0 ? globalTargetLangs : undefined;
        if (!fileLangsToProcess) {
            const extracted = extractTargetLangs(absoluteFile);
            fileLangsToProcess = extracted.length > 0 ? extracted : [undefined] as any;
        }

        for (const targetLang of fileLangsToProcess!) {
            let actualDest = finalDest;
            if (targetLang) {
                // Insert language identifier before the `.md` extension
                actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
            }

            console.log(`[BUILD] Compiling ${relativeFile} ${targetLang ? `[${targetLang}]` : ''} -> ${path.relative(cwd, actualDest)}`);

            try {
                const dir = path.dirname(actualDest);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const compiledContent = await compileFile(absoluteFile, actualDest, new Set(), targetLang);
                fs.writeFileSync(actualDest, compiledContent, 'utf8');
                console.log(`[BUILD] ✅ Success: ${path.relative(cwd, actualDest)}`);

                if (verify) {
                    const verified = await verifyCompiledContent(compiledContent, model);
                    if (!verified) {
                        console.log(`[BUILD] 🛑 Verification failed for ${relativeFile} (${targetLang}), aborting further builds.`);
                        process.exit(1);
                    }
                }
            } catch (e: any) {
                console.error(`[BUILD] ❌ Failed to compile ${relativeFile} (${targetLang}): ${e.message}`);
                console.error(e);
            }
        }
    }
}
