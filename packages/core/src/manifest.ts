import * as fs from 'fs';
import { parseFrontmatter } from './frontmatter';
import { VasmFrontmatter } from './types';

export type ManifestSeverity = 'warn' | 'error';

export interface ManifestDiagnostic {
    severity: ManifestSeverity;
    code: string;
    message: string;
}

export interface VasmManifestSummary {
    alias?: string;
    version?: string;
    kind?: string;
    compileFormat?: string;
    domains?: string[];
    filePatterns?: string[];
    capabilities?: Record<string, unknown>;
    activationIntent?: string[];
    activationPriority?: number;
    conflictsWith?: string[];
    trustSource?: string;
    trustLicense?: string;
}

const allowedKinds = new Set(['prompt', 'skill', 'doc', 'policy', 'fragment']);
const allowedCapabilityKeys = new Set([
    'readFiles',
    'editFiles',
    'runCommands',
    'network',
    'externalModels',
    'publish',
]);

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
    const summary: VasmManifestSummary = {
        alias: manifest.alias,
        version: manifest.version,
        kind: manifest.kind,
        compileFormat: manifest.compile?.format,
        domains: manifest.scope?.domains,
        filePatterns: manifest.scope?.filePatterns,
        capabilities: manifest.capabilities,
        activationIntent: manifest.activation?.intent,
        activationPriority: manifest.activation?.priority,
        conflictsWith: manifest.activation?.conflictsWith,
        trustSource: manifest.trust?.source,
        trustLicense: manifest.trust?.license,
    };

    return Object.fromEntries(
        Object.entries(summary).filter(([, value]) => value !== undefined)
    ) as VasmManifestSummary;
}

export function validateVasmManifest(manifest: VasmFrontmatter['vasm'] | undefined): ManifestDiagnostic[] {
    const diagnostics: ManifestDiagnostic[] = [];
    if (!manifest) return diagnostics;

    if (manifest.kind && !allowedKinds.has(manifest.kind)) {
        addDiagnostic(diagnostics, 'error', 'manifest.kind.invalid', `Unknown vasm.kind '${manifest.kind}'.`);
    }

    if (manifest.scope !== undefined) {
        if (!isObject(manifest.scope)) {
            addDiagnostic(diagnostics, 'error', 'manifest.scope.invalid', 'vasm.scope must be an object.');
        } else {
            if (manifest.scope.domains !== undefined && !isStringArray(manifest.scope.domains)) {
                addDiagnostic(diagnostics, 'error', 'manifest.scope.domains.invalid', 'vasm.scope.domains must be a string array.');
            }
            if (manifest.scope.filePatterns !== undefined && !isStringArray(manifest.scope.filePatterns)) {
                addDiagnostic(diagnostics, 'error', 'manifest.scope.filePatterns.invalid', 'vasm.scope.filePatterns must be a string array.');
            }
        }
    }

    if (manifest.capabilities !== undefined) {
        if (!isObject(manifest.capabilities)) {
            addDiagnostic(diagnostics, 'error', 'manifest.capabilities.invalid', 'vasm.capabilities must be an object.');
        } else {
            for (const [key, value] of Object.entries(manifest.capabilities)) {
                if (!allowedCapabilityKeys.has(key)) {
                    addDiagnostic(diagnostics, 'warn', 'manifest.capabilities.unknown', `Unknown capability '${key}'.`);
                } else if (typeof value !== 'boolean') {
                    addDiagnostic(diagnostics, 'error', 'manifest.capabilities.value.invalid', `Capability '${key}' must be boolean.`);
                }
            }
        }
    }

    if (manifest.activation !== undefined) {
        if (!isObject(manifest.activation)) {
            addDiagnostic(diagnostics, 'error', 'manifest.activation.invalid', 'vasm.activation must be an object.');
        } else {
            if (manifest.activation.intent !== undefined && !isStringArray(manifest.activation.intent)) {
                addDiagnostic(diagnostics, 'error', 'manifest.activation.intent.invalid', 'vasm.activation.intent must be a string array.');
            }
            if (manifest.activation.conflictsWith !== undefined && !isStringArray(manifest.activation.conflictsWith)) {
                addDiagnostic(diagnostics, 'error', 'manifest.activation.conflictsWith.invalid', 'vasm.activation.conflictsWith must be a string array.');
            }
            if (manifest.activation.priority !== undefined) {
                const priority = manifest.activation.priority;
                if (typeof priority !== 'number' || priority < 0 || priority > 100) {
                    addDiagnostic(diagnostics, 'error', 'manifest.activation.priority.invalid', 'vasm.activation.priority must be a number between 0 and 100.');
                }
            }
        }
    }

    if (manifest.compatibility?.formats !== undefined && !isStringArray(manifest.compatibility.formats)) {
        addDiagnostic(diagnostics, 'error', 'manifest.compatibility.formats.invalid', 'vasm.compatibility.formats must be a string array.');
    }

    if (manifest.trust?.maintainers !== undefined && !isStringArray(manifest.trust.maintainers)) {
        addDiagnostic(diagnostics, 'error', 'manifest.trust.maintainers.invalid', 'vasm.trust.maintainers must be a string array.');
    }

    if (manifest.kind === 'skill') {
        if (!manifest.alias) {
            addDiagnostic(diagnostics, 'warn', 'skill.alias.missing', 'Skill should declare vasm.alias for stable references.');
        }
        if (!manifest.version) {
            addDiagnostic(diagnostics, 'warn', 'skill.version.missing', 'Skill should declare vasm.version for human compatibility review.');
        }
        if (!manifest.scope?.domains?.length && !manifest.activation?.intent?.length) {
            addDiagnostic(diagnostics, 'warn', 'skill.activation.missing', 'Skill should declare scope.domains or activation.intent so AI can choose it deliberately.');
        }
        if (!manifest.capabilities) {
            addDiagnostic(diagnostics, 'warn', 'skill.capabilities.missing', 'Skill should declare capabilities to make its permission surface explicit.');
        }
        if (!manifest.trust?.source) {
            addDiagnostic(diagnostics, 'warn', 'skill.trust.source.missing', 'Skill should declare trust.source for supply-chain review.');
        }
        if (!manifest.trust?.license) {
            addDiagnostic(diagnostics, 'warn', 'skill.trust.license.missing', 'Skill should declare trust.license.');
        }
    }

    return diagnostics;
}
