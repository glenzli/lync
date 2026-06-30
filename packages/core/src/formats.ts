export type CompileFormat = 'informational' | 'executable' | 'integrative';
export type DeprecatedCompileFormat = 'doc' | 'prompt';
export type RawCompileFormat = CompileFormat | DeprecatedCompileFormat;

export const COMPILE_FORMATS: CompileFormat[] = ['informational', 'executable', 'integrative'];
export const DEPRECATED_COMPILE_FORMATS: DeprecatedCompileFormat[] = ['doc', 'prompt'];

const deprecatedFormatMap: Record<DeprecatedCompileFormat, CompileFormat> = {
    doc: 'informational',
    prompt: 'executable',
};

export interface CompileFormatNormalization {
    format: CompileFormat;
    deprecated?: DeprecatedCompileFormat;
}

export function isCompileFormat(value: unknown): value is CompileFormat {
    return typeof value === 'string' && COMPILE_FORMATS.includes(value as CompileFormat);
}

export function isDeprecatedCompileFormat(value: unknown): value is DeprecatedCompileFormat {
    return typeof value === 'string' && DEPRECATED_COMPILE_FORMATS.includes(value as DeprecatedCompileFormat);
}

export function normalizeCompileFormat(value: unknown, fallback: CompileFormat = 'executable'): CompileFormatNormalization {
    if (isCompileFormat(value)) return { format: value };
    if (isDeprecatedCompileFormat(value)) return { format: deprecatedFormatMap[value], deprecated: value };
    return { format: fallback };
}

export function assertCompileFormat(value: unknown, fileLabel: string, fallback: CompileFormat = 'executable'): CompileFormatNormalization {
    if (value === undefined || value === null || value === '') return { format: fallback };
    if (isCompileFormat(value) || isDeprecatedCompileFormat(value)) return normalizeCompileFormat(value, fallback);
    throw new Error(`Invalid vasm.compile.format '${String(value)}' in ${fileLabel}. Expected informational, executable, or integrative.`);
}

export function deprecatedCompileFormatTargetConfigKey(format: CompileFormat): DeprecatedCompileFormat | undefined {
    if (format === 'informational') return 'doc';
    if (format === 'executable') return 'prompt';
    return undefined;
}

export function formatDeprecationMessage(deprecated: DeprecatedCompileFormat, fileLabel: string): string {
    const replacement = deprecatedFormatMap[deprecated];
    return `vasm.compile.format '${deprecated}' is deprecated in ${fileLabel}; use '${replacement}' instead.`;
}
