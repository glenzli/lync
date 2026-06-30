import * as fs from 'fs';
import { parseFrontmatter } from './frontmatter';
import { VasmFrontmatter } from './types';
import { COMPILE_FORMATS, DEPRECATED_COMPILE_FORMATS, isCompileFormat, isDeprecatedCompileFormat, normalizeCompileFormat } from './formats';

export type ManifestSeverity = 'warn' | 'error';

export interface ManifestDiagnostic {
    severity: ManifestSeverity;
    code: string;
    message: string;
}

export interface VasmManifestSummary {
    alias?: string;
    version?: string;
    compileFormat?: string;
    deprecatedCompileFormat?: string;
    intent?: string;
}

const removedFields = [
    'kind',
    'scope',
    'capabilities',
    'activation',
    'compatibility',
    'trust',
    'vision',
    'fix',
];

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function addDiagnostic(diagnostics: ManifestDiagnostic[], severity: ManifestSeverity, code: string, message: string) {
    diagnostics.push({ severity, code, message });
}

export function readVasmManifest(filePath: string): VasmFrontmatter['vasm'] | undefined {
    if (!fs.existsSync(filePath)) return undefined;
    const parsed = parseFrontmatter(fs.readFileSync(filePath, 'utf8')) as { data: VasmFrontmatter };
    return parsed.data?.vasm;
}

export function summarizeVasmManifest(manifest: VasmFrontmatter['vasm'] | undefined): VasmManifestSummary | undefined {
    if (!manifest) return undefined;
    const rawFormat = manifest.compile?.format;
    const normalized = normalizeCompileFormat(rawFormat);
    const summary: VasmManifestSummary = {
        alias: manifest.alias,
        version: manifest.version,
        compileFormat: rawFormat ? normalized.format : undefined,
        deprecatedCompileFormat: normalized.deprecated,
        intent: manifest.intent,
    };

    return Object.fromEntries(
        Object.entries(summary).filter(([, value]) => value !== undefined)
    ) as VasmManifestSummary;
}

export function validateVasmManifest(manifest: VasmFrontmatter['vasm'] | undefined): ManifestDiagnostic[] {
    const diagnostics: ManifestDiagnostic[] = [];
    if (!manifest) return diagnostics;

    const rawManifest = manifest as Record<string, unknown>;
    for (const field of removedFields) {
        if (rawManifest[field] === undefined) continue;
        addDiagnostic(
            diagnostics,
            'error',
            `manifest.${field}.removed`,
            `vasm.${field} was removed from the manifest protocol. Use alias, version, intent, compile, and dependencies only.`
        );
    }

    if (manifest.alias !== undefined && typeof manifest.alias !== 'string') {
        addDiagnostic(diagnostics, 'error', 'manifest.alias.invalid', 'vasm.alias must be a string.');
    }
    if (manifest.version !== undefined && typeof manifest.version !== 'string') {
        addDiagnostic(diagnostics, 'error', 'manifest.version.invalid', 'vasm.version must be a string.');
    }
    if (manifest.intent !== undefined && typeof manifest.intent !== 'string') {
        addDiagnostic(diagnostics, 'error', 'manifest.intent.invalid', 'vasm.intent must be a string.');
    }

    if (manifest.compile !== undefined) {
        if (!isObject(manifest.compile)) {
            addDiagnostic(diagnostics, 'error', 'manifest.compile.invalid', 'vasm.compile must be an object.');
        } else {
            const rawFormat = manifest.compile.format;
            if (rawFormat !== undefined) {
                if (isDeprecatedCompileFormat(rawFormat)) {
                    addDiagnostic(
                        diagnostics,
                        'warn',
                        'manifest.compile.format.deprecated',
                        `vasm.compile.format '${rawFormat}' is deprecated; use '${normalizeCompileFormat(rawFormat).format}' instead.`
                    );
                } else if (!isCompileFormat(rawFormat)) {
                    addDiagnostic(
                        diagnostics,
                        'error',
                        'manifest.compile.format.invalid',
                        `vasm.compile.format must be one of ${COMPILE_FORMATS.join(', ')}. Deprecated compatibility accepts ${DEPRECATED_COMPILE_FORMATS.join(', ')}.`
                    );
                }
            }
            if (manifest.compile.targetLangs !== undefined && !isStringArray(manifest.compile.targetLangs)) {
                addDiagnostic(diagnostics, 'error', 'manifest.compile.targetLangs.invalid', 'vasm.compile.targetLangs must be a string array.');
            }
        }
    }

    if (manifest.dependencies !== undefined && !isObject(manifest.dependencies)) {
        addDiagnostic(diagnostics, 'error', 'manifest.dependencies.invalid', 'vasm.dependencies must be an object.');
    }

    return diagnostics;
}
