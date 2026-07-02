import type { RawCompileFormat } from './formats';

export interface VasmRc {
    lang?: string;
}

export interface DependencyConfig {
    url?: string;
    dest?: string;
}

export type DependencyDeclaration = string | DependencyConfig;

export interface VasmConfig {
    dependencies?: Record<string, DependencyDeclaration>;
}

export interface VasmFrontmatter {
    vasm?: {
        alias?: string;
        version?: string;
        /** Human-readable intent summary for AI review and integration. */
        intent?: string;
        integration?: {
            /** Files, output paths, or vasm:<alias> targets that this integrative guide applies to. */
            appliesTo?: string[];
        };
        compile?: {
            format?: RawCompileFormat;
            targetLangs?: string[];
        };
        dependencies?: Record<string, DependencyDeclaration>;
    }
}

export interface LockDependency {
    url: string;
    dest?: string;
    version?: string;
    hash: string;
    fetchedAt: string;
}

export interface VasmLock {
    version: number;
    dependencies: Record<string, LockDependency>;
}

export interface BuildRoutingRule {
    match: string;
    dest: string;
}

export interface ProjectReviewConfig {
    mode?: 'off' | 'suggest' | 'patch';
    include?: string[];
    exclude?: string[];
    maxFiles?: number;
    maxFileBytes?: number;
}

export interface VasmBuild {
    includes?: string[];
    excludes?: string[];
    output?: {
        dir?: string;
        flat?: boolean;
        inPlace?: boolean;
    };
    baseDir?: string;
    routing?: BuildRoutingRule[];
    compile?: {
        informational?: {
            targetLangs?: string[];
        };
        executable?: {
            targetLangs?: string[];
        };
        /** @deprecated integrative sources are source-only and are not cross-compiled */
        integrative?: {
            targetLangs?: string[];
        };
        /** @deprecated use informational */
        doc?: {
            targetLangs?: string[];
        };
        /** @deprecated use executable */
        prompt?: {
            targetLangs?: string[];
        };
    };
    security?: {
        /** review: report policy risk only; enforce: block unsafe skill outputs from being updated. */
        mode?: 'review' | 'enforce';
    };
    ai?: {
        /** Project-aware AI pass emitted as build instructions, never executed by VASMC itself. */
        projectReview?: ProjectReviewConfig;
    };
}
