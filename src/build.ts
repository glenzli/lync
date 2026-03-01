import { glob } from 'glob';
import { minimatch } from 'minimatch';
import * as path from 'path';
import * as fs from 'fs';
import { loadBuildConfig } from './config';
import { compileFile, extractTargetLangs } from './compiler';
import { verifyCompiledContent, analyzeSemanticDiff } from './verify';
import { t } from './i18n';
import { estimateTokens } from './utils';

export async function runWorkspaceBuild(cwd: string = process.cwd(), verify?: boolean, model?: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[]; diff?: boolean; verifyContinueOnError?: boolean }) {
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
        console.log(t('BUILD_NO_FILES', includes.join(', ')));
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

        let bestVerifyContent = '';
        let minTokens = Infinity;
        let bestLang = 'auto';

        for (const targetLang of fileLangsToProcess!) {
            let actualDest = finalDest;
            if (targetLang) {
                // Insert language identifier before the `.md` extension
                actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
            }

            console.log(t('BUILD_COMPILING', relativeFile, targetLang ? `[${targetLang}]` : '', path.relative(cwd, actualDest)));

            try {
                const dir = path.dirname(actualDest);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                let oldContent = '';
                if (cliOptions?.diff && fs.existsSync(actualDest)) {
                    oldContent = fs.readFileSync(actualDest, 'utf8');
                }

                const compiledContent = await compileFile(absoluteFile, actualDest, new Set(), targetLang);
                fs.writeFileSync(actualDest, compiledContent, 'utf8');
                console.log(t('BUILD_SUCCESS', path.relative(cwd, actualDest)));

                if (verify) {
                    const tokens = estimateTokens(compiledContent);
                    if (tokens < minTokens) {
                        minTokens = tokens;
                        bestVerifyContent = compiledContent;
                        bestLang = targetLang || 'auto';
                    }
                }

                if (cliOptions?.diff && oldContent && oldContent !== compiledContent) {
                    await analyzeSemanticDiff(oldContent, compiledContent, model);
                }
            } catch (e: any) {
                console.error(t('BUILD_ERR_WORKSPACE', relativeFile, targetLang || 'auto', e.message));
                console.error(e);
            }
        }

        if (verify && bestVerifyContent) {
            if (fileLangsToProcess!.length > 1) {
                console.log(t('LINT_SELECT_BEST', bestLang, minTokens));
            }
            const verified = await verifyCompiledContent(bestVerifyContent, model);
            if (!verified.passed) {
                const continueOnError = cliOptions?.verifyContinueOnError ?? buildConfig.verifyContinueOnError;
                if (verified.error && continueOnError) {
                    console.log(t('LINT_ERR_CONTINUE'));
                } else {
                    console.log(t('BUILD_VERIFY_FAILED', relativeFile, bestLang));
                    process.exit(1);
                }
            }
        }
    }
}
