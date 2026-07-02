import * as fs from 'fs';
import * as path from 'path';
import { collectDependencies } from './compiler';
import { loadLockfile } from './config';
import { ManifestDiagnostic, readVasmManifest, validateVasmManifest } from './manifest';
import { computeHash } from './network';
import { CompileFormat, isCompileFormat, isDeprecatedCompileFormat, normalizeCompileFormat } from './formats';

export type PolicyStatus = 'pass' | 'review' | 'blocked';
export type PolicyGate = 'review' | 'block';
export type PolicyDiagnosticSource = 'manifest' | 'lockfile' | 'format';
export type PolicyContentSignalKind =
    | 'prompt_override'
    | 'concealment'
    | 'secret_exfiltration'
    | 'remote_execution';
export type PolicyContentSignalStance = 'unknown' | 'prohibitive';
export type PolicyContentSignalConfidence = 'low' | 'medium';

export interface PolicyDiagnostic extends ManifestDiagnostic {
    path: string;
    source: PolicyDiagnosticSource;
    gate: PolicyGate;
}

export interface PolicyContentSignal {
    code: `policy.content.${PolicyContentSignalKind}`;
    kind: PolicyContentSignalKind;
    message: string;
    path: string;
    source: 'content';
    line?: number;
    evidence?: string;
    stance: PolicyContentSignalStance;
    confidence: PolicyContentSignalConfidence;
    review: string;
}

export interface PolicyEntry {
    relativeFile: string;
    absoluteFile: string;
    finalDest: string;
    compileFormat: CompileFormat;
}

export interface PolicyVerdict {
    status: PolicyStatus;
    enforceable: boolean;
    diagnostics: PolicyDiagnostic[];
    contentSignals: PolicyContentSignal[];
}

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

function readDeclaredFormat(filePath: string): CompileFormat | undefined {
    const rawFormat = readVasmManifest(filePath)?.compile?.format;
    if (isCompileFormat(rawFormat) || isDeprecatedCompileFormat(rawFormat)) {
        return normalizeCompileFormat(rawFormat).format;
    }
    return undefined;
}

function collectFormatDiagnostics(entry: PolicyEntry, files: string[], cwd: string): PolicyDiagnostic[] {
    const diagnostics: PolicyDiagnostic[] = [];

    for (const filePath of files) {
        if (path.resolve(filePath) === path.resolve(entry.absoluteFile)) continue;
        const dependencyFormat = readDeclaredFormat(filePath);
        if (!dependencyFormat) continue;

        if (entry.compileFormat === 'informational' && dependencyFormat !== 'informational') {
            diagnostics.push({
                severity: 'error',
                code: 'policy.format.informational_imports_active',
                message: `Informational output imports ${dependencyFormat} content. Move active guidance behind an executable or integrative entry.`,
                path: relative(cwd, filePath),
                source: 'format',
                gate: 'block',
            });
        }

        if (entry.compileFormat === 'executable' && dependencyFormat === 'integrative') {
            diagnostics.push({
                severity: 'warn',
                code: 'policy.format.executable_imports_integrative',
                message: 'Executable output imports integrative guidance. Review whether the dependency should guide composition instead of entering the final executable prompt.',
                path: relative(cwd, filePath),
                source: 'format',
                gate: 'review',
            });
        }

        if (entry.compileFormat === 'integrative' && dependencyFormat === 'executable') {
            diagnostics.push({
                severity: 'warn',
                code: 'policy.format.integrative_imports_executable',
                message: 'Integrative output imports executable content. Review whether it summarizes composition guidance rather than re-exporting an executable prompt.',
                path: relative(cwd, filePath),
                source: 'format',
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

function detectProhibitiveStance(line: string): PolicyContentSignalStance {
    return /\b(do not|don't|never|must not|should not|avoid)\b/i.test(line)
        || /(不要|禁止|不得|不能|不应|避免|勿)/.test(line)
        ? 'prohibitive'
        : 'unknown';
}

function collectContentSignals(files: string[], cwd: string): PolicyContentSignal[] {
    const signals: PolicyContentSignal[] = [];
    const linePatterns: Array<{
        kind: PolicyContentSignalKind;
        message: string;
        review: string;
        test: (line: string) => boolean;
    }> = [
        {
            kind: 'prompt_override',
            message: 'Content contains text that may override previous or higher-priority instructions.',
            review: 'Decide whether the text is an active instruction, a prohibition, an example, or documentation.',
            test: line => /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)/i.test(line)
                || /忽略.*(之前|以上|前面).*(指令|规则)/.test(line),
        },
        {
            kind: 'concealment',
            message: 'Content contains text that may hide behavior from the user or reviewer.',
            review: 'Decide whether the text instructs concealment or warns against concealment.',
            test: line => /(do not|don't)\s+(tell|mention|reveal|explain)\s+(the\s+)?user/i.test(line)
                || /不要(告诉|透露|提及|说明).*用户/.test(line)
                || /向用户隐藏/.test(line),
        },
        {
            kind: 'secret_exfiltration',
            message: 'Content combines secret access words with exfiltration words.',
            review: 'Decide whether the text requests secret exfiltration or prohibits it.',
            test: line => /(api[_ -]?key|secret|token|credential|env|environment variable|环境变量|密钥|令牌|凭据)/i.test(line)
                && /(send|upload|post|exfiltrat|leak|steal|发送|上传|泄露|窃取|外传)/i.test(line),
        },
        {
            kind: 'remote_execution',
            message: 'Content combines remote-fetch words with execution words.',
            review: 'Decide whether the text requests remote execution or prohibits it.',
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
                const stance = detectProhibitiveStance(trimmed);
                signals.push({
                    code: `policy.content.${pattern.kind}`,
                    kind: pattern.kind,
                    message: pattern.message,
                    path: relative(cwd, filePath),
                    source: 'content',
                    line: index + 1,
                    evidence: trimmed.slice(0, 180),
                    stance,
                    confidence: stance === 'prohibitive' ? 'low' : 'medium',
                    review: pattern.review,
                });
            }
        }
    }

    return signals.slice(0, 20);
}

export function evaluateVasmPolicy(entry: PolicyEntry, cwd: string): PolicyVerdict {
    const files = collectGraphFiles(entry, cwd);
    const enforceable = entry.compileFormat === 'executable';
    const diagnostics: PolicyDiagnostic[] = [];
    const contentSignals: PolicyContentSignal[] = [];

    for (const filePath of files) {
        diagnostics.push(...collectManifestPolicyDiagnostics(filePath, cwd));
    }
    diagnostics.push(...collectLockfileDiagnostics(files, cwd));
    diagnostics.push(...collectFormatDiagnostics(entry, files, cwd));

    if (enforceable) {
        contentSignals.push(...collectContentSignals(files, cwd));
    }

    const status = diagnostics.some(diagnostic => diagnostic.gate === 'block')
        ? 'blocked'
        : diagnostics.length > 0
            ? 'review'
            : 'pass';

    return { status, enforceable, diagnostics, contentSignals };
}
