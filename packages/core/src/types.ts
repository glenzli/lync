import type { RawCompileFormat } from './formats';

export interface VasmRc {
    lang?: string;
}

export interface DependencyConfig {
    url?: string;
    /** vasmc-catalog.yaml reference. When set, `export` selects one catalog export. */
    catalog?: string;
    /** Catalog export key. Defaults to the dependency alias. */
    export?: string;
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
    source?: 'url' | 'catalog';
    catalog?: string;
    export?: string;
    name?: string;
    format?: RawCompileFormat;
    /** Catalog artifact hashes that an integrative dependency applies to. */
    appliesTo?: string[];
    hash: string;
    fetchedAt: string;
}

export interface VasmLock {
    version: number;
    dependencies: Record<string, LockDependency>;
}

export type CatalogExportDeclaration = string | {
    /** Source .vasm.md entry that should be exported into the catalog artifact set. */
    source: string;
    /** Optional language filter for the released artifact. */
    targetLang?: string;
    /** Optional catalog-relative artifact path. Defaults to <vasm.alias>[.<targetLang>].md. */
    file?: string;
};

export interface VasmCatalogConfig {
    /** Directory where vasmc-catalog.yaml and exported artifacts are written. */
    outDir?: string;
    /** Public export entries keyed by catalog-local export id. */
    exports?: Record<string, CatalogExportDeclaration>;
}

export interface VasmCatalogExport {
    name: string;
    version: string;
    format: RawCompileFormat;
    file: string;
    hash: string;
    /** Artifact hashes that an integrative export applies to. */
    appliesTo?: string[];
}

export interface VasmCatalog {
    catalogVersion: 1;
    exports: Record<string, VasmCatalogExport>;
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
    catalog?: VasmCatalogConfig;
    compile?: {
        informational?: {
            targetLangs?: string[];
        };
        executable?: {
            targetLangs?: string[];
        };
        /** Integrative outputs are single composition guide artifacts and are not cross-compiled. */
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
