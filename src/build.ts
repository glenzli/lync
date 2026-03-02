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
                    fs.writeFileSync(
                        path.resolve(cacheDir, `history-${timestamp}-${path.basename(actualDest)}`),
                        oldContent, 'utf8'
                    );
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

        // Append agent instructions
        const instructions = `
# Lync Agent Instructions — \`${entry.relativeFile}\`

**Minimal-Token Variant:** ${path.relative(cwd, finalDest.replace(/\.md$/, bestLang === 'auto' ? '.md' : `.${bestLang}.md`))} (${minTokens} tokens)
**Target Languages:** ${targetLangs.join(', ')}

\`\`\`yaml
compiledFiles:
${targetLangs.map(lang => `  - ${path.relative(cwd, finalDest.replace(/\.md$/, lang === 'auto' || !lang ? '.md' : `.${lang}.md`))}`).join('\n')}
\`\`\`

## 🛠️ Action Items
1. **Verify**: Check the minimal-token variant for conflicting instructions or missing context.
2. **Translate**: Expand the minimal-token variant into other required language files.
3. **Tree-Shake**: Analyze if any imported context can be safely truncated.
        `.trim();

        fs.appendFileSync(instructionsPath, '\n\n' + instructions, 'utf8');
        console.log(`[AGENT] 🤖 Instructions appended for: ${entry.relativeFile}`);
    }

    console.log(`\n[AGENT] 📋 Full instructions: ${path.relative(cwd, instructionsPath)}`);
}
