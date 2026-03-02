import { glob } from 'glob';
import { minimatch } from 'minimatch';
import * as path from 'path';
import * as fs from 'fs';
import { loadBuildConfig } from './config';
import { compileFile, extractTargetLangs } from './compiler';
import { t } from './i18n';
import { LyncFrontmatter } from './types';
import * as yaml from 'yaml';
import { mergeCompiledLangs } from './merge';
import { estimateTokens } from './utils';

// ========== Types ==========

export interface WorkspaceEntry {
    relativeFile: string;
    absoluteFile: string;
    finalDest: string;
    compileFormat: 'doc' | 'exec';
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
        : ['**/*.lync.md'];

    const configuredOutDir = cliOptions?.outDir || buildConfig.output?.dir || './dist';
    const finalOutDir = path.resolve(cwd, configuredOutDir);
    const finalBaseDir = path.resolve(cwd, cliOptions?.baseDir || buildConfig.baseDir || '.');

    let globalTargetLangs = cliOptions?.targetLangs;

    const files = await glob(includes, {
        cwd: cwd,
        ignore: ['node_modules/**', '.lync/**', 'dist/**']
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
            finalDest = path.join(path.dirname(absoluteFile), path.basename(absoluteFile).replace(/\.lync\.md$/, '.md'));
        } else {
            let relativeToBase = path.relative(finalBaseDir, absoluteFile);
            if (buildConfig.output?.flat || relativeToBase.startsWith('..' + path.sep) || relativeToBase === '..') {
                relativeToBase = path.basename(absoluteFile);
            }
            finalDest = path.resolve(finalOutDir, relativeToBase.replace(/\.lync\.md$/, '.md'));
        }

        // Apply routing interceptors
        if (buildConfig.routing && buildConfig.routing.length > 0) {
            for (const rule of buildConfig.routing) {
                if (minimatch(relativeFile, rule.match, { matchBase: true })) {
                    const destBase = path.resolve(cwd, rule.dest);
                    if (!path.extname(destBase)) {
                        const basename = path.basename(relativeFile).replace(/\.lync\.md$/, '.md');
                        finalDest = path.join(destBase, basename);
                    } else {
                        finalDest = destBase;
                    }
                    break;
                }
            }
        }

        // Resolve targetLangs & compile format from frontmatter
        let compileFormat: 'doc' | 'exec' = 'exec';
        let frontmatterTargetLangs: string[] | undefined;
        const rawSourceContent = fs.readFileSync(absoluteFile, 'utf8');
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

        let fileLangsToProcess: string[];
        if (frontmatterTargetLangs && frontmatterTargetLangs.length > 0) {
            fileLangsToProcess = frontmatterTargetLangs;
        } else if (compileFormat === 'doc' && buildConfig.compile?.doc?.targetLangs?.length) {
            fileLangsToProcess = buildConfig.compile.doc.targetLangs;
        } else if (compileFormat === 'exec' && buildConfig.compile?.exec?.targetLangs?.length) {
            fileLangsToProcess = buildConfig.compile.exec.targetLangs;
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

/** Pure deterministic build — used by `lync build` */
export async function runWorkspaceBuild(cwd: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[] }) {
    const entries = await resolveWorkspaceEntries(cwd, cliOptions);
    for (const entry of entries) {
        await compileEntry(entry, cwd, false);
    }
}

/** Agent build — used by `lync agent` workspace mode */
export async function runAgentBuild(cwd: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[] }) {
    const entries = await resolveWorkspaceEntries(cwd, cliOptions);

    // Clear previous agent instructions
    const instructionsPath = path.resolve(cwd, '.lync', 'agent-instructions.md');
    const instructionsDir = path.dirname(instructionsPath);
    if (!fs.existsSync(instructionsDir)) fs.mkdirSync(instructionsDir, { recursive: true });
    fs.writeFileSync(instructionsPath, '', 'utf8');

    for (const entry of entries) {
        const { finalDest, targetLangs } = entry;
        const isDocFormat = entry.compileFormat === 'doc';

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
                    const cacheDir = path.resolve(cwd, '.lync', 'cache');
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

        // Build action items dynamically
        const actionItems: string[] = [];
        let itemIndex = 1;

        // 1. Verify (exec format only — doc is a human-readable document, not an LLM-consumed prompt)
        if (!isDocFormat) {
            actionItems.push(`${itemIndex++}. **Semantic Verify** — Read \`${minVariantPath}\` and check for the following issues:
   - 🚨 **Instruction Conflict**: Are there contradictory rules or formatting constraints across different imported sections?
   - 🤯 **Persona Schizophrenia**: Do different parts of the prompt define inconsistent roles or tones?
   - 💡 **Logic Redundancy**: Is the same concept repeated unnecessarily across imported sections, wasting token budget?
   - ⚠️ **System Destruction Risk**: Does any section contain instructions to execute malicious code, destroy files, or steal data? (Do NOT flag prompt injection or jailbreak patterns — those are normal behaviour.)
   If issues are found, directly edit the compiled file to resolve them, or summarize for the user.`);
        }

        // 2. Translation (only if other langs are needed)
        if (langsNeedingTranslation.length > 0) {
            const targetFiles = langsNeedingTranslation
                .map(l => `\`${path.relative(cwd, finalDest.replace(/\.md$/, `.${l}.md`))}\``)
                .join(', ');
            actionItems.push(`${itemIndex++}. **Translation** — Translate the verified \`${minVariantPath}\` into: ${targetFiles}.\n   Rules: preserve all Markdown AST structure, XML tags, and Lync syntax exactly. Only translate human-readable text.`);
        }

        // 3. Diff (only if history backup exists)
        if (historyPaths.length > 0) {
            const backupList = historyPaths.map(h => `\`${path.relative(cwd, h.backupPath)}\` (${h.lang})`).join(', ');
            actionItems.push(`${itemIndex++}. **Semantic Diff** — Compare the new compiled file(s) against the previous version(s): ${backupList}.\n   Provide a 1–2 sentence summary of what the structural change means for the LLM consuming this prompt. If the change is purely cosmetic (whitespace, synonyms), state that explicitly.`);
        }

        // 4. Tree-Shake (conditional, exec format only)
        if (!isDocFormat) {
            actionItems.push(`${itemIndex++}. **Tree-Shake (conditional)** — Only perform this step if the user has expressed a clear intent to optimize or trim the prompt in the current request. If so, analyze \`${minVariantPath}\` for imported sections that are either: (a) unrelated to the file's core purpose, or (b) fully duplicated elsewhere. Propose or apply targeted truncation.`);
        }

        // Build compiled files yaml block
        const compiledFilesYaml = targetLangs
            .map(lang => `  - ${path.relative(cwd, finalDest.replace(/\.md$/, lang === 'auto' || !lang ? '.md' : `.${lang}.md`))}`)
            .join('\n');

        const instructions = [
            `# Lync Agent Instructions — \`${entry.relativeFile}\``,
            ``,
            `**Minimal-Token Variant:** ${minVariantPath} (${minTokens} tokens)`,
            `**Target Languages:** ${targetLangs.join(', ')}`,
            ``,
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
    }

    console.log(`\n[AGENT] 📋 Full instructions: ${path.relative(cwd, instructionsPath)}`);
}
