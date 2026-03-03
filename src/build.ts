import { glob } from 'glob';
import { minimatch } from 'minimatch';
import * as path from 'path';
import * as fs from 'fs';
import { loadBuildConfig } from './config';
import { compileFile, extractTargetLangs, collectDependencies } from './compiler';
import { t } from './i18n';
import { VasmFrontmatter } from './types';
import * as yaml from 'yaml';
import { mergeCompiledLangs } from './merge';
import { estimateTokens } from './utils';
import { loadBuildState, saveBuildState, computeInputSignature, buildStateKey } from './buildstate';

// ========== Types ==========

export interface WorkspaceEntry {
    relativeFile: string;
    absoluteFile: string;
    finalDest: string;
    compileFormat: 'doc' | 'prompt';
    targetLangs: string[];
}

export interface CompiledResult {
    entry: WorkspaceEntry;
    compiledMap: Map<string, string>;  // lang -> content
}

// ========== Layer 1: Workspace Resolution ==========

export async function resolveWorkspaceEntries(cwd: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[] }): Promise<WorkspaceEntry[]> {
    const buildConfig = loadBuildConfig(cwd);

    const includes = buildConfig.includes && buildConfig.includes.length > 0
        ? buildConfig.includes
        : ['**/*.vasm.md'];

    const configuredOutDir = cliOptions?.outDir || buildConfig.output?.dir || './dist';
    const finalOutDir = path.resolve(cwd, configuredOutDir);
    const finalBaseDir = path.resolve(cwd, cliOptions?.baseDir || buildConfig.baseDir || '.');

    let globalTargetLangs = cliOptions?.targetLangs;

    const defaultIgnore = ['node_modules/**', '.vasmc/**', 'dist/**'];
    const userExcludes = buildConfig.excludes || [];
    const files = await glob(includes, {
        cwd: cwd,
        ignore: [...defaultIgnore, ...userExcludes]
    });

    if (files.length === 0) {
        console.log(t('BUILD_NO_FILES', includes.join(', ')));
        return [];
    }

    const entries: WorkspaceEntry[] = [];

    for (const relativeFile of files) {
        const absoluteFile = path.resolve(cwd, relativeFile);

        // Resolve destination
        let finalDest;
        if (buildConfig.output?.inPlace && !cliOptions?.outDir) {
            finalDest = path.join(path.dirname(absoluteFile), path.basename(absoluteFile).replace(/\.vasm\.md$/, '.md'));
        } else {
            let relativeToBase = path.relative(finalBaseDir, absoluteFile);
            if (buildConfig.output?.flat || relativeToBase.startsWith('..' + path.sep) || relativeToBase === '..') {
                relativeToBase = path.basename(absoluteFile);
            }
            finalDest = path.resolve(finalOutDir, relativeToBase.replace(/\.vasm\.md$/, '.md'));
        }

        // Apply routing interceptors
        if (buildConfig.routing && buildConfig.routing.length > 0) {
            for (const rule of buildConfig.routing) {
                if (minimatch(relativeFile, rule.match, { matchBase: true })) {
                    const destBase = path.resolve(cwd, rule.dest);
                    if (!path.extname(destBase)) {
                        const basename = path.basename(relativeFile).replace(/\.vasm\.md$/, '.md');
                        finalDest = path.join(destBase, basename);
                    } else {
                        finalDest = destBase;
                    }
                    break;
                }
            }
        }

        // Resolve targetLangs & compile format from frontmatter
        let compileFormat: 'doc' | 'prompt' = 'prompt';
        let frontmatterTargetLangs: string[] | undefined;
        const rawSourceContent = fs.readFileSync(absoluteFile, 'utf8');
        const fmMatch = /^---\n([\s\S]*?)\n---/.exec(rawSourceContent);
        if (fmMatch) {
            try {
                const fm = yaml.parse(fmMatch[1]) as VasmFrontmatter;
                if (fm?.vasm?.compile?.format) {
                    compileFormat = fm.vasm.compile.format;
                }
                if (fm?.vasm?.compile?.targetLangs) {
                    frontmatterTargetLangs = fm.vasm.compile.targetLangs;
                }
            } catch (e) { }
        }

        let fileLangsToProcess: string[];
        if (frontmatterTargetLangs && frontmatterTargetLangs.length > 0) {
            fileLangsToProcess = frontmatterTargetLangs;
        } else if (compileFormat === 'doc' && buildConfig.compile?.doc?.targetLangs?.length) {
            fileLangsToProcess = buildConfig.compile.doc.targetLangs;
        } else if (compileFormat === 'prompt' && buildConfig.compile?.prompt?.targetLangs?.length) {
            fileLangsToProcess = buildConfig.compile.prompt.targetLangs;
        } else if (globalTargetLangs && globalTargetLangs.length > 0) {
            fileLangsToProcess = globalTargetLangs;
        } else {
            const extracted = extractTargetLangs(absoluteFile);
            fileLangsToProcess = extracted.length > 0 ? extracted : [undefined] as any;
        }

        entries.push({
            relativeFile,
            absoluteFile,
            finalDest,
            compileFormat,
            targetLangs: fileLangsToProcess
        });
    }

    return entries;
}

// ========== Layer 2: Per-Entry Compilation ==========

export async function compileEntry(entry: WorkspaceEntry, cwd: string, agentMode: boolean = false): Promise<CompiledResult> {
    const { relativeFile, absoluteFile, finalDest, compileFormat, targetLangs } = entry;
    const isDocFormat = compileFormat === 'doc';
    const compiledMap = new Map<string, string>();

    for (const targetLang of targetLangs) {
        let actualDest = finalDest;
        if (!isDocFormat && targetLang && targetLang !== 'auto' && targetLangs.length > 1) {
            actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
        }

        console.log(t('BUILD_COMPILING', relativeFile, targetLang ? `[${targetLang}]` : '', path.relative(cwd, actualDest)));

        try {
            const dir = path.dirname(actualDest);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const compiledContent = await compileFile(absoluteFile, actualDest, new Set(), targetLang, agentMode);
            compiledMap.set(targetLang || 'auto', compiledContent);

            if (!isDocFormat) {
                fs.writeFileSync(actualDest, compiledContent, 'utf8');
                console.log(t('BUILD_SUCCESS', path.relative(cwd, actualDest)));
            }
        } catch (e: any) {
            console.error(t('BUILD_ERR_WORKSPACE', relativeFile, targetLang || 'auto', e.message));
            console.error(e);
            if (e.message && e.message.startsWith('[FATAL]')) {
                throw e;
            }
        }
    }

    // Handle doc format merging
    if (isDocFormat && compiledMap.size > 0) {
        try {
            const dir = path.dirname(finalDest);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            console.log(`[MERGE] 🪄 Merging ${compiledMap.size} languages into ${path.relative(cwd, finalDest)}`);
            const mergedContent = mergeCompiledLangs(compiledMap);
            fs.writeFileSync(finalDest, mergedContent, 'utf8');
            console.log(t('BUILD_SUCCESS', path.relative(cwd, finalDest)));
        } catch (e: any) {
            console.error(`[MERGE_ERR] ❌ Failed to merge ${relativeFile}: ${e.message}`);
            console.error(e);
        }
    }

    return { entry, compiledMap };
}

// ========== Layer 3: Command Composers ==========

/** Pure deterministic build — used by `vasmc build` */
export async function runWorkspaceBuild(cwd: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[] }) {
    const entries = await resolveWorkspaceEntries(cwd, cliOptions);
    const buildState = loadBuildState(cwd);
    let stateChanged = false;

    for (const entry of entries) {
        const { relativeFile, absoluteFile, finalDest, targetLangs } = entry;
        const isDocFormat = entry.compileFormat === 'doc';
        const outputFile = isDocFormat ? finalDest : finalDest; // both point to finalDest for cache key

        // Check incremental cache for each lang
        let allSkipped = true;
        if (isDocFormat) {
            // Doc format: single merged key, but must also check targetLangs set hasn't changed
            const key = buildStateKey(relativeFile, 'merged');
            const cached = buildState.entries[key];
            if (cached && fs.existsSync(finalDest)) {
                const deps = collectDependencies(absoluteFile, cwd);
                const sig = computeInputSignature(deps);
                const cachedLangs = [...(cached.targetLangs || [])].sort().join(',');
                const currentLangs = [...targetLangs].sort().join(',');
                if (cached.inputSignature === sig && cachedLangs === currentLangs) {
                    // truly unchanged: same source AND same target languages
                } else {
                    allSkipped = false;
                }
            } else {
                allSkipped = false;
            }
        } else {
            for (const targetLang of targetLangs) {
                let actualDest = finalDest;
                if (targetLang && targetLang !== 'auto' && targetLangs.length > 1) {
                    actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                }
                const key = buildStateKey(relativeFile, targetLang || 'auto');
                const cached = buildState.entries[key];
                if (cached && fs.existsSync(actualDest)) {
                    const deps = collectDependencies(absoluteFile, cwd);
                    const sig = computeInputSignature(deps);
                    if (cached.inputSignature === sig) {
                        continue;
                    }
                }
                allSkipped = false;
                break;
            }
        }

        if (allSkipped) {
            console.log(`[BUILD] ⚡️ Skipped (unchanged): ${relativeFile}`);
            continue;
        }

        // Full compile
        await compileEntry(entry, cwd, false);

        // Update cache after successful compile
        const deps = collectDependencies(absoluteFile, cwd);
        const sig = computeInputSignature(deps);
        if (isDocFormat) {
            const key = buildStateKey(relativeFile, 'merged');
            buildState.entries[key] = {
                inputSignature: sig,
                outputFile: path.relative(cwd, finalDest),
                targetLang: 'merged',
                targetLangs: [...targetLangs].sort(),
            };
        } else {
            for (const targetLang of targetLangs) {
                const key = buildStateKey(relativeFile, targetLang || 'auto');
                let actualDest = finalDest;
                if (targetLang && targetLang !== 'auto' && targetLangs.length > 1) {
                    actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                }
                buildState.entries[key] = {
                    inputSignature: sig,
                    outputFile: path.relative(cwd, actualDest),
                    targetLang: targetLang || 'auto',
                };
            }
        }
        stateChanged = true;
    }

    if (stateChanged) {
        saveBuildState(buildState, cwd);
    }
}

/** Agent build — used by `vasmc agent` workspace mode */
export async function runAgentBuild(cwd: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[] }) {
    const entries = await resolveWorkspaceEntries(cwd, cliOptions);
    const buildState = loadBuildState(cwd);
    let stateChanged = false;

    // Clear previous agent instructions
    const instructionsPath = path.resolve(cwd, '.vasmc', 'agent-instructions.md');
    const instructionsDir = path.dirname(instructionsPath);
    if (!fs.existsSync(instructionsDir)) fs.mkdirSync(instructionsDir, { recursive: true });
    fs.writeFileSync(instructionsPath, '', 'utf8');

    for (const entry of entries) {
        const { relativeFile, absoluteFile, finalDest, targetLangs } = entry;
        const isDocFormat = entry.compileFormat === 'doc';

        // Extract vision and fix from source frontmatter
        let vision: string | undefined;
        let fixMode: 'suggest' | 'auto' = 'suggest';
        if (!isDocFormat) {
            const rawSrc = fs.readFileSync(absoluteFile, 'utf8');
            const fmMatch = /^---\n([\s\S]*?)\n---/.exec(rawSrc);
            if (fmMatch) {
                try {
                    const fm = yaml.parse(fmMatch[1]) as VasmFrontmatter;
                    if (fm?.vasm?.vision) vision = fm.vasm.vision.trim();
                    if (fm?.vasm?.fix) fixMode = fm.vasm.fix;
                } catch { }
            }
        }

        // Incremental skip check for agent mode
        let allSkipped = true;
        if (isDocFormat) {
            const key = buildStateKey(relativeFile, 'merged');
            const cached = buildState.entries[key];
            if (cached && fs.existsSync(finalDest)) {
                const deps = collectDependencies(absoluteFile, cwd);
                const sig = computeInputSignature(deps);
                const cachedLangs = [...(cached.targetLangs || [])].sort().join(',');
                const currentLangs = [...targetLangs].sort().join(',');
                if (!(cached.inputSignature === sig && cachedLangs === currentLangs)) {
                    allSkipped = false;
                }
            } else {
                allSkipped = false;
            }
        } else {
            for (const targetLang of targetLangs) {
                let actualDest = finalDest;
                if (targetLang && targetLang !== 'auto' && targetLangs.length > 1) {
                    actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                }
                const key = buildStateKey(relativeFile, targetLang || 'auto');
                const cached = buildState.entries[key];
                if (cached && fs.existsSync(actualDest)) {
                    const deps = collectDependencies(absoluteFile, cwd);
                    const sig = computeInputSignature(deps);
                    if (cached.inputSignature === sig) continue;
                }
                allSkipped = false;
                break;
            }
        }
        if (allSkipped) {
            console.log(`[AGENT] ⚡️ Skipped (unchanged): ${relativeFile}`);
            continue;
        }

        // Cache old content for agent history diffing
        const historyPaths: { lang: string; backupPath: string }[] = [];
        if (!isDocFormat) {
            for (const targetLang of targetLangs) {
                let actualDest = finalDest;
                if (targetLang && targetLang !== 'auto' && targetLangs.length > 1) {
                    actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                }
                if (fs.existsSync(actualDest)) {
                    const oldContent = fs.readFileSync(actualDest, 'utf8');
                    const cacheDir = path.resolve(cwd, '.vasmc', 'cache');
                    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                    const timestamp = new Date().getTime();
                    const backupPath = path.resolve(cacheDir, `history-${timestamp}-${path.basename(actualDest)}`);
                    fs.writeFileSync(backupPath, oldContent, 'utf8');
                    historyPaths.push({ lang: targetLang || 'auto', backupPath });
                }
            }
        }

        // Compile with agent mode (zero LLM)
        const result = await compileEntry(entry, cwd, true);

        // Find minimal-token variant
        let minTokens = Infinity;
        let bestLang = 'auto';
        for (const [lang, content] of result.compiledMap) {
            const tokens = estimateTokens(content);
            if (tokens < minTokens) {
                minTokens = tokens;
                bestLang = lang;
            }
        }

        const minVariantPath = path.relative(cwd, finalDest.replace(/\.md$/, bestLang === 'auto' ? '.md' : `.${bestLang}.md`));
        const langsNeedingTranslation = targetLangs.filter(l => (l || 'auto') !== bestLang && l !== 'auto');

        // Build action items as a lean work order (execution manifest, not tutorial)
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

        // 2. Translation (only if other langs needed)
        if (langsNeedingTranslation.length > 0) {
            const targetFiles = langsNeedingTranslation
                .map(l => `\`${path.relative(cwd, finalDest.replace(/\.md$/, `.${l}.md`))}\``)
                .join(', ');
            actionItems.push(`${itemIndex++}. **Translate** \`${minVariantPath}\` → ${targetFiles}`);
        }

        // 3. Diff (only if history backup exists)
        if (historyPaths.length > 0) {
            const backupList = historyPaths.map(h => `\`${path.relative(cwd, h.backupPath)}\` (${h.lang})`).join(', ');
            const diffPrereq = actionItems.some(a => a.includes('Verify')) ? ' *(prerequisite: Verify & Fix must be completed first)*' : '';
            actionItems.push(`${itemIndex++}. **Diff** against ${backupList}${diffPrereq}`);
        }

        // 4. Tree-Shake (conditional, exec only)
        if (!isDocFormat) {
            actionItems.push(`${itemIndex++}. **Tree-Shake** \`${minVariantPath}\` *(conditional — only if user requested optimization)*`);
        }

        // Build compiled files yaml block
        const compiledFilesYaml = targetLangs
            .map(lang => `  - ${path.relative(cwd, finalDest.replace(/\.md$/, lang === 'auto' || !lang ? '.md' : `.${lang}.md`))}`)
            .join('\n');

        const visionLines = vision
            ? [`**Vision:** ${vision.replace(/\n/g, ' ')}`, `**Fix Mode:** ${fixMode}`, ``]
            : [];

        const instructions = [
            `# VASMC Agent Instructions — \`${entry.relativeFile}\``,
            ``,
            `**Minimal-Token Variant:** ${minVariantPath} (${minTokens} tokens)`,
            `**Target Languages:** ${targetLangs.join(', ')}`,
            ...visionLines,
            `\`\`\`yaml`,
            `compiledFiles:`,
            compiledFilesYaml,
            `\`\`\``,
            ``,
            `## 🛠️ Action Items`,
            ``,
            actionItems.join('\n\n'),
        ].join('\n');

        fs.appendFileSync(instructionsPath, '\n\n' + instructions, 'utf8');
        console.log(`[AGENT] 🤖 Instructions appended for: ${entry.relativeFile}`);

        // Update incremental build cache after successful agent compile
        const deps = collectDependencies(absoluteFile, cwd);
        const sig = computeInputSignature(deps);
        if (isDocFormat) {
            const key = buildStateKey(relativeFile, 'merged');
            buildState.entries[key] = {
                inputSignature: sig,
                outputFile: path.relative(cwd, finalDest),
                targetLang: 'merged',
                targetLangs: [...targetLangs].sort(),
            };
        } else {
            for (const targetLang of targetLangs) {
                const key = buildStateKey(relativeFile, targetLang || 'auto');
                let actualDest = finalDest;
                if (targetLang && targetLang !== 'auto' && targetLangs.length > 1) {
                    actualDest = finalDest.replace(/\.md$/, `.${targetLang}.md`);
                }
                buildState.entries[key] = {
                    inputSignature: sig,
                    outputFile: path.relative(cwd, actualDest),
                    targetLang: targetLang || 'auto',
                };
            }
        }
        stateChanged = true;
    }

    if (stateChanged) {
        saveBuildState(buildState, cwd);
    }

    console.log(`\n[AGENT] 📋 Full instructions: ${path.relative(cwd, instructionsPath)}`);
}

