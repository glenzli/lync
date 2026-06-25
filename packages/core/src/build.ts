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
import { readVasmManifest, summarizeVasmManifest, validateVasmManifest, ManifestDiagnostic, VasmManifestSummary } from './manifest';
import { evaluateVasmPolicy, PolicyDiagnostic, PolicyStatus } from './policy';

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

export interface BuildReportDiagnostic extends ManifestDiagnostic {
    path: string;
}

export interface BuildReportPolicyDiagnostic extends PolicyDiagnostic { }

export interface BuildReportPolicy {
    status: PolicyStatus;
    enforceable: boolean;
    diagnostics?: BuildReportPolicyDiagnostic[];
}

export interface BuildReportDependency {
    path: string;
    manifest?: VasmManifestSummary;
    diagnostics?: BuildReportDiagnostic[];
}

export interface BuildReportEntry {
    source: string;
    output: string;
    status: 'built' | 'skipped' | 'blocked';
    format: 'doc' | 'prompt';
    targetLangs: string[];
    policy: BuildReportPolicy;
    manifest?: VasmManifestSummary;
    diagnostics?: BuildReportDiagnostic[];
    dependencies?: BuildReportDependency[];
}

export interface BuildReport {
    version: 1;
    mode: 'ai-build';
    generatedAt: string;
    instructionsFile: string;
    entries: BuildReportEntry[];
}

function collectManifestDiagnostics(filePath: string, cwd: string): BuildReportDiagnostic[] {
    const manifest = readVasmManifest(filePath);
    return validateVasmManifest(manifest).map(diagnostic => ({
        path: path.relative(cwd, filePath),
        ...diagnostic,
    }));
}

function collectDependencyManifestReports(filePath: string, cwd: string): BuildReportDependency[] {
    return [...collectDependencies(filePath, cwd)]
        .filter(depPath => depPath !== filePath)
        .map(depPath => {
            const manifest = readVasmManifest(depPath);
            const diagnostics = collectManifestDiagnostics(depPath, cwd);
            const report: BuildReportDependency = {
                path: path.relative(cwd, depPath),
            };
            const summary = summarizeVasmManifest(manifest);
            if (summary) report.manifest = summary;
            if (diagnostics.length > 0) report.diagnostics = diagnostics;
            return report;
        });
}

export function createBuildReportEntry(entry: WorkspaceEntry, cwd: string, status: 'built' | 'skipped' | 'blocked'): BuildReportEntry {
    const manifest = readVasmManifest(entry.absoluteFile);
    const diagnostics = collectManifestDiagnostics(entry.absoluteFile, cwd);
    const dependencies = collectDependencyManifestReports(entry.absoluteFile, cwd);
    const policy = evaluateVasmPolicy(entry, cwd);
    const report: BuildReportEntry = {
        source: entry.relativeFile,
        output: path.relative(cwd, entry.finalDest),
        status,
        format: entry.compileFormat,
        targetLangs: entry.targetLangs,
        policy: {
            status: policy.status,
            enforceable: policy.enforceable,
        },
    };
    if (policy.diagnostics.length > 0) report.policy.diagnostics = policy.diagnostics;
    const summary = summarizeVasmManifest(manifest);
    if (summary) report.manifest = summary;
    if (diagnostics.length > 0) report.diagnostics = diagnostics;
    if (dependencies.length > 0) report.dependencies = dependencies;
    return report;
}

export function flattenReportDiagnostics(entryReport: BuildReportEntry): BuildReportDiagnostic[] {
    const diagnostics = [...(entryReport.diagnostics || [])];
    for (const dependency of entryReport.dependencies || []) {
        diagnostics.push(...(dependency.diagnostics || []));
    }
    return diagnostics;
}

export function getPolicyDiagnostics(entryReport: BuildReportEntry): BuildReportPolicyDiagnostic[] {
    return entryReport.policy.diagnostics || [];
}

export function formatPolicyDiagnostics(diagnostics: Array<BuildReportDiagnostic | BuildReportPolicyDiagnostic>): string {
    return diagnostics
        .map(diagnostic => `${diagnostic.severity.toUpperCase()} ${diagnostic.code} (${diagnostic.path}): ${diagnostic.message}`)
        .join('; ');
}

export function formatPolicyAction(entryReport: BuildReportEntry, itemIndex: number): string | undefined {
    if (entryReport.policy.status === 'pass') return undefined;
    const diagnostics = getPolicyDiagnostics(entryReport);
    if (diagnostics.length === 0) return undefined;
    const label = entryReport.policy.status === 'blocked' ? 'Policy Gate' : 'Policy Review';
    return `${itemIndex}. **${label}** \`.vasmc/build-report.yaml\` — ${formatPolicyDiagnostics(diagnostics)}`;
}

export function shouldBlockPolicyOutput(entryReport: BuildReportEntry, securityMode: 'review' | 'enforce' = 'review'): boolean {
    return securityMode === 'enforce'
        && entryReport.policy.enforceable
        && entryReport.policy.status === 'blocked';
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

    // In AI build mode for prompt format with multiple langs, only compile the source language.
    // Non-source languages will be produced by AI translation (build-instructions.md Translate step).
    // Compiling them here would: (a) write wrong placeholder files to disk, (b) count tokens on
    // identical source content, making the token comparison meaningless.
    let langsToCompile = targetLangs;
    if (agentMode && !isDocFormat && targetLangs.length > 1) {
        const rawContent = fs.readFileSync(absoluteFile, 'utf8');
        const { detectLanguage } = await import('./utils');
        const detected = detectLanguage(rawContent);
        let sourceLang = targetLangs[0];
        if (detected && targetLangs.includes(detected)) {
            sourceLang = detected;
        } else if (!detected) {
            console.warn(t('LANG_DETECT_AGENT_FALLBACK', relativeFile, sourceLang));
        }
        langsToCompile = [sourceLang];
    }

    for (const targetLang of langsToCompile) {
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

/** Pure deterministic build — used by non-AI tooling and core API consumers. */
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

/** AI build — used by the AI-facing `vasmc build` workspace mode */
export async function runAIBuild(cwd: string, cliOptions?: { baseDir?: string; outDir?: string; targetLangs?: string[] }) {
    const entries = await resolveWorkspaceEntries(cwd, cliOptions);
    const buildConfig = loadBuildConfig(cwd);
    const securityMode = buildConfig.security?.mode || 'review';
    const buildState = loadBuildState(cwd);
    let stateChanged = false;

    // Clear previous AI build instructions
    const instructionsPath = path.resolve(cwd, '.vasmc', 'build-instructions.md');
    const reportPath = path.resolve(cwd, '.vasmc', 'build-report.yaml');
    const instructionsDir = path.dirname(instructionsPath);
    if (!fs.existsSync(instructionsDir)) fs.mkdirSync(instructionsDir, { recursive: true });
    fs.writeFileSync(instructionsPath, '', 'utf8');
    const buildReport: BuildReport = {
        version: 1,
        mode: 'ai-build',
        generatedAt: new Date().toISOString(),
        instructionsFile: path.relative(cwd, instructionsPath),
        entries: [],
    };

    for (const entry of entries) {
        const { relativeFile, absoluteFile, finalDest, targetLangs } = entry;
        const isDocFormat = entry.compileFormat === 'doc';
        const skippedReport = createBuildReportEntry(entry, cwd, 'skipped');
        const policyAction = (itemIndex: number) => formatPolicyAction(skippedReport, itemIndex);

        if (shouldBlockPolicyOutput(skippedReport, securityMode)) {
            const blockedReport = createBuildReportEntry(entry, cwd, 'blocked');
            buildReport.entries.push(blockedReport);
            const action = formatPolicyAction(blockedReport, 1);
            const instructions = [
                `# VASMC Build Instructions — \`${entry.relativeFile}\``,
                ``,
                `## 🛠️ Action Items`,
                ``,
                action || `1. **Policy Gate** \`.vasmc/build-report.yaml\` — review blocked policy status.`,
                ``,
                `Final output was not updated because \`security.mode\` is \`enforce\`.`,
            ].join('\n');
            fs.appendFileSync(instructionsPath, '\n\n' + instructions, 'utf8');
            console.warn(`[BUILD] ⛔ Blocked by policy gate: ${relativeFile}`);
            continue;
        }

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

        // Incremental skip check for AI build mode
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
            console.log(`[BUILD] ⚡️ Skipped (unchanged): ${relativeFile}`);
            buildReport.entries.push(skippedReport);
            const action = policyAction(1);
            if (action) {
                const instructions = [
                    `# VASMC Build Instructions — \`${entry.relativeFile}\``,
                    ``,
                    `## 🛠️ Action Items`,
                    ``,
                    action,
                ].join('\n');
                fs.appendFileSync(instructionsPath, '\n\n' + instructions, 'utf8');
                console.log(`[BUILD] 🤖 Policy review instructions appended for: ${entry.relativeFile}`);
            }
            continue;
        }

        // Cache old content for AI diff work orders
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

        // Compile with AI build mode (zero LLM)
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

        const outputPathForLang = (lang?: string) => {
            if (!isDocFormat && lang && lang !== 'auto' && targetLangs.length > 1) {
                return finalDest.replace(/\.md$/, `.${lang}.md`);
            }
            return finalDest;
        };
        const minVariantPath = path.relative(cwd, outputPathForLang(bestLang));
        const langsNeedingTranslation = isDocFormat
            ? []
            : targetLangs.filter(l => (l || 'auto') !== bestLang && l !== 'auto');

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
                .map(l => `\`${path.relative(cwd, outputPathForLang(l))}\``)
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

        const action = policyAction(itemIndex);
        if (action) {
            actionItems.push(action);
            itemIndex++;
        }

        if (actionItems.length > 0) {
            // Build compiled files yaml block
            const compiledFilesYaml = targetLangs
                .map(lang => `  - ${path.relative(cwd, outputPathForLang(lang))}`)
                .join('\n');

            const visionLines = vision
                ? [`**Vision:** ${vision.replace(/\n/g, ' ')}`, `**Fix Mode:** ${fixMode}`, ``]
                : [];

            const instructions = [
                `# VASMC Build Instructions — \`${entry.relativeFile}\``,
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
            console.log(`[BUILD] 🤖 Instructions appended for: ${entry.relativeFile}`);
        }

        // Update incremental build cache after successful AI build
        const builtReport = createBuildReportEntry(entry, cwd, 'built');
        buildReport.entries.push(builtReport);
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

    if (fs.readFileSync(instructionsPath, 'utf8').trim().length === 0) {
        fs.writeFileSync(
            instructionsPath,
            [
                '# VASMC Build Instructions',
                '',
                'No pending action items.',
                '',
                `See \`${path.relative(cwd, reportPath)}\` for the full build report.`,
            ].join('\n'),
            'utf8'
        );
    }

    fs.writeFileSync(reportPath, yaml.stringify(buildReport), 'utf8');
    console.log(`[BUILD] 📋 Build report: ${path.relative(cwd, reportPath)}`);
    console.log(`\n[BUILD] 📋 Full instructions: ${path.relative(cwd, instructionsPath)}`);
}
