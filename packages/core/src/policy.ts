import * as fs from 'fs';
import * as path from 'path';
import { collectDependencies } from './compiler';
import { loadLockfile } from './config';
import { ManifestDiagnostic, readVasmManifest, validateVasmManifest } from './manifest';
import { computeHash } from './network';
import type { VasmFrontmatter } from './types';

export type PolicyStatus = 'pass' | 'review' | 'blocked';
export type PolicyGate = 'review' | 'block';
export type PolicyDiagnosticSource = 'manifest' | 'lockfile' | 'capability' | 'activation' | 'content';

export interface PolicyDiagnostic extends ManifestDiagnostic {
    path: string;
    source: PolicyDiagnosticSource;
    gate: PolicyGate;
    line?: number;
    evidence?: string;
}

export interface PolicyEntry {
    relativeFile: string;
    absoluteFile: string;
    finalDest: string;
    compileFormat: 'doc' | 'prompt';
}

export interface PolicyVerdict {
    status: PolicyStatus;
    enforceable: boolean;
    diagnostics: PolicyDiagnostic[];
}

type CapabilityKey = 'readFiles' | 'editFiles' | 'runCommands' | 'network' | 'externalModels' | 'publish';

const capabilityKeys: CapabilityKey[] = [
    'readFiles',
    'editFiles',
    'runCommands',
    'network',
    'externalModels',
    'publish',
];

const highRiskCapabilities: CapabilityKey[] = ['network', 'externalModels', 'publish'];

function relative(cwd: string, filePath: string): string {
    return path.relative(cwd, filePath) || '.';
}

function diagnosticGate(diagnostic: ManifestDiagnostic): PolicyGate {
    return diagnostic.severity === 'error' ? 'block' : 'review';
}

function toPolicyDiagnostic(filePath: string, cwd: string, diagnostic: ManifestDiagnostic): PolicyDiagnostic {
    return {
        ...diagnostic,
        path: relative(cwd, filePath),
        source: 'manifest',
        gate: diagnosticGate(diagnostic),
    };
}

function collectManifestPolicyDiagnostics(filePath: string, cwd: string): PolicyDiagnostic[] {
    const manifest = readVasmManifest(filePath);
    return validateVasmManifest(manifest).map(diagnostic => toPolicyDiagnostic(filePath, cwd, diagnostic));
}

function isSkillLikeEntry(entry: PolicyEntry, cwd: string, manifest: VasmFrontmatter['vasm'] | undefined): boolean {
    if (manifest?.kind === 'skill') return true;
    const outputParts = path.normalize(relative(cwd, entry.finalDest)).split(path.sep);
    return outputParts.includes('skills');
}

function collectGraphFiles(entry: PolicyEntry, cwd: string): string[] {
    return [...collectDependencies(entry.absoluteFile, cwd)];
}

function collectLockfileDiagnostics(files: string[], cwd: string): PolicyDiagnostic[] {
    const diagnostics: PolicyDiagnostic[] = [];
    const lock = loadLockfile(cwd);
    const lockedPaths = new Map<string, { alias: string; hash: string }>();

    for (const [alias, locked] of Object.entries(lock.dependencies || {})) {
        const depPath = locked.dest
            ? path.resolve(cwd, locked.dest)
            : path.resolve(cwd, '.vasmc', `${alias}.md`);
        lockedPaths.set(depPath, { alias, hash: locked.hash });
    }

    for (const filePath of files) {
        const locked = lockedPaths.get(path.resolve(filePath));
        if (!locked) continue;
        if (!fs.existsSync(filePath)) {
            diagnostics.push({
                severity: 'error',
                code: 'policy.lockfile.missing',
                message: `Locked dependency '${locked.alias}' is missing on disk.`,
                path: relative(cwd, filePath),
                source: 'lockfile',
                gate: 'block',
            });
            continue;
        }

        const currentHash = computeHash(fs.readFileSync(filePath, 'utf8'));
        if (currentHash !== locked.hash) {
            diagnostics.push({
                severity: 'error',
                code: 'policy.lockfile.hash_mismatch',
                message: `Locked dependency '${locked.alias}' hash does not match vasmc-lock.yaml.`,
                path: relative(cwd, filePath),
                source: 'lockfile',
                gate: 'block',
            });
        }
    }

    return diagnostics;
}

function collectCapabilityDiagnostics(entry: PolicyEntry, files: string[], cwd: string, rootManifest: VasmFrontmatter['vasm'] | undefined): PolicyDiagnostic[] {
    const diagnostics: PolicyDiagnostic[] = [];
    const rootCapabilities = rootManifest?.capabilities || {};

    for (const capability of highRiskCapabilities) {
        if (rootCapabilities[capability] === true) {
            diagnostics.push({
                severity: 'warn',
                code: 'policy.capability.high_risk',
                message: `Skill declares high-risk capability '${capability}'.`,
                path: relative(cwd, entry.absoluteFile),
                source: 'capability',
                gate: 'review',
            });
        }
    }

    for (const filePath of files) {
        if (path.resolve(filePath) === path.resolve(entry.absoluteFile)) continue;
        const dependencyManifest = readVasmManifest(filePath);
        const dependencyCapabilities = dependencyManifest?.capabilities;
        if (!dependencyCapabilities) continue;

        for (const capability of capabilityKeys) {
            if (dependencyCapabilities[capability] !== true) continue;
            if (rootCapabilities[capability] === true) continue;
            diagnostics.push({
                severity: 'error',
                code: 'policy.capability.escalation',
                message: `Dependency requires '${capability}' but the entry skill does not declare it.`,
                path: relative(cwd, filePath),
                source: 'capability',
                gate: 'block',
            });
        }
    }

    return diagnostics;
}

function collectActivationDiagnostics(entry: PolicyEntry, cwd: string, manifest: VasmFrontmatter['vasm'] | undefined): PolicyDiagnostic[] {
    const diagnostics: PolicyDiagnostic[] = [];
    const intents = manifest?.activation?.intent || [];
    const broadIntent = /^(all|any|anything|everything|default|always|general|global)$/i;
    const broadIntentZh = /(所有|任何|全部|一切|默认|总是|全局|通用)/;

    for (const intent of intents) {
        if (broadIntent.test(intent.trim()) || broadIntentZh.test(intent)) {
            diagnostics.push({
                severity: 'warn',
                code: 'policy.activation.too_broad',
                message: `Activation intent '${intent}' is too broad for automatic routing.`,
                path: relative(cwd, entry.absoluteFile),
                source: 'activation',
                gate: 'review',
            });
        }
    }

    if ((manifest?.activation?.priority ?? 0) >= 95) {
        diagnostics.push({
            severity: 'warn',
            code: 'policy.activation.high_priority',
            message: 'Activation priority is very high and should be reviewed for routing hijack risk.',
            path: relative(cwd, entry.absoluteFile),
            source: 'activation',
            gate: 'review',
        });
    }

    return diagnostics;
}

function normalizeActivationIntent(intent: string): string {
    return intent
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ');
}

function collectActivationGraphDiagnostics(entry: PolicyEntry, files: string[], cwd: string, rootManifest: VasmFrontmatter['vasm'] | undefined): PolicyDiagnostic[] {
    const diagnostics: PolicyDiagnostic[] = [];
    const rootAlias = rootManifest?.alias;
    const rootIntents = new Set((rootManifest?.activation?.intent || []).map(normalizeActivationIntent));
    const rootConflicts = new Set((rootManifest?.activation?.conflictsWith || []).map(normalizeActivationIntent));
    const rootPriority = rootManifest?.activation?.priority ?? 0;
    const seenIntentOwners = new Map<string, { alias: string; path: string }>();

    for (const filePath of files) {
        const manifest = readVasmManifest(filePath);
        if (manifest?.kind !== 'skill' || !manifest.activation) continue;

        const alias = manifest.alias || relative(cwd, filePath);
        const normalizedAlias = normalizeActivationIntent(alias);
        const intents = manifest.activation.intent || [];
        const priority = manifest.activation.priority ?? 0;
        const isRoot = path.resolve(filePath) === path.resolve(entry.absoluteFile);

        for (const conflict of manifest.activation.conflictsWith || []) {
            const normalizedConflict = normalizeActivationIntent(conflict);
            if (normalizedConflict === normalizeActivationIntent(rootAlias || '') || rootConflicts.has(normalizedAlias)) {
                diagnostics.push({
                    severity: 'warn',
                    code: 'policy.activation.conflict',
                    message: `Skill '${alias}' declares activation conflict with '${conflict}'.`,
                    path: relative(cwd, filePath),
                    source: 'activation',
                    gate: 'review',
                });
            }
        }

        for (const intent of intents) {
            const normalizedIntent = normalizeActivationIntent(intent);
            if (!normalizedIntent) continue;

            const existing = seenIntentOwners.get(normalizedIntent);
            if (existing && existing.alias !== alias) {
                diagnostics.push({
                    severity: 'warn',
                    code: 'policy.activation.intent_collision',
                    message: `Activation intent '${intent}' is declared by both '${existing.alias}' and '${alias}'.`,
                    path: relative(cwd, filePath),
                    source: 'activation',
                    gate: 'review',
                });
            } else {
                seenIntentOwners.set(normalizedIntent, { alias, path: filePath });
            }

            if (!isRoot && rootIntents.has(normalizedIntent)) {
                diagnostics.push({
                    severity: 'warn',
                    code: 'policy.activation.dependency_overlap',
                    message: `Dependency skill '${alias}' shares entry activation intent '${intent}'.`,
                    path: relative(cwd, filePath),
                    source: 'activation',
                    gate: 'review',
                });
            }
        }

        if (!isRoot && priority > rootPriority && intents.some(intent => rootIntents.has(normalizeActivationIntent(intent)))) {
            diagnostics.push({
                severity: 'warn',
                code: 'policy.activation.priority_hijack',
                message: `Dependency skill '${alias}' has priority ${priority}, higher than entry priority ${rootPriority}, for overlapping activation intent.`,
                path: relative(cwd, filePath),
                source: 'activation',
                gate: 'review',
            });
        }
    }

    return diagnostics;
}

function stripCodeAndFrontmatter(content: string): string {
    return content
        .replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`\n]+`/g, '');
}

function collectContentDiagnostics(files: string[], cwd: string): PolicyDiagnostic[] {
    const diagnostics: PolicyDiagnostic[] = [];
    const linePatterns: Array<{ code: string; message: string; test: (line: string) => boolean }> = [
        {
            code: 'policy.content.prompt_override',
            message: 'Content appears to override previous or higher-priority instructions.',
            test: line => /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)/i.test(line)
                || /忽略.*(之前|以上|前面).*(指令|规则)/.test(line),
        },
        {
            code: 'policy.content.concealment',
            message: 'Content appears to hide behavior from the user or reviewer.',
            test: line => /(do not|don't)\s+(tell|mention|reveal|explain)\s+(the\s+)?user/i.test(line)
                || /不要(告诉|透露|提及|说明).*用户/.test(line)
                || /向用户隐藏/.test(line),
        },
        {
            code: 'policy.content.secret_exfiltration',
            message: 'Content appears to combine secret access with exfiltration language.',
            test: line => /(api[_ -]?key|secret|token|credential|env|environment variable|环境变量|密钥|令牌|凭据)/i.test(line)
                && /(send|upload|post|exfiltrat|leak|steal|发送|上传|泄露|窃取|外传)/i.test(line),
        },
        {
            code: 'policy.content.remote_execution',
            message: 'Content appears to request downloading and running remote code.',
            test: line => /(download|curl|wget).*(run|execute|bash|sh|powershell)/i.test(line)
                || /下载.*(执行|运行)/.test(line),
        },
    ];

    for (const filePath of files) {
        if (!fs.existsSync(filePath)) continue;
        const lines = stripCodeAndFrontmatter(fs.readFileSync(filePath, 'utf8')).split(/\r?\n/);
        for (const [index, line] of lines.entries()) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            for (const pattern of linePatterns) {
                if (!pattern.test(trimmed)) continue;
                diagnostics.push({
                    severity: 'warn',
                    code: pattern.code,
                    message: pattern.message,
                    path: relative(cwd, filePath),
                    source: 'content',
                    gate: 'review',
                    line: index + 1,
                    evidence: trimmed.slice(0, 180),
                });
            }
        }
    }

    return diagnostics.slice(0, 20);
}

export function evaluateVasmPolicy(entry: PolicyEntry, cwd: string): PolicyVerdict {
    const rootManifest = readVasmManifest(entry.absoluteFile);
    const files = collectGraphFiles(entry, cwd);
    const enforceable = isSkillLikeEntry(entry, cwd, rootManifest);
    const diagnostics: PolicyDiagnostic[] = [];

    for (const filePath of files) {
        diagnostics.push(...collectManifestPolicyDiagnostics(filePath, cwd));
    }
    diagnostics.push(...collectLockfileDiagnostics(files, cwd));

    if (enforceable) {
        diagnostics.push(...collectCapabilityDiagnostics(entry, files, cwd, rootManifest));
        diagnostics.push(...collectActivationDiagnostics(entry, cwd, rootManifest));
        diagnostics.push(...collectActivationGraphDiagnostics(entry, files, cwd, rootManifest));
        diagnostics.push(...collectContentDiagnostics(files, cwd));
    }

    const status = diagnostics.some(diagnostic => diagnostic.gate === 'block')
        ? 'blocked'
        : diagnostics.length > 0
            ? 'review'
            : 'pass';

    return { status, enforceable, diagnostics };
}
