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
        /** Module category. `skill` enables stricter policy diagnostics for skill governance. */
        kind?: 'prompt' | 'skill' | 'doc' | 'policy' | 'fragment';
        compile?: {
            format?: 'doc' | 'prompt';
            targetLangs?: string[];
        };
        dependencies?: Record<string, DependencyDeclaration>;
        scope?: {
            domains?: string[];
            filePatterns?: string[];
        };
        capabilities?: {
            readFiles?: boolean;
            editFiles?: boolean;
            runCommands?: boolean;
            network?: boolean;
            externalModels?: boolean;
            publish?: boolean;
        };
        activation?: {
            intent?: string[];
            priority?: number;
            conflictsWith?: string[];
        };
        compatibility?: {
            vasm?: string;
            formats?: Array<'doc' | 'prompt'>;
        };
        trust?: {
            source?: string;
            license?: string;
            maintainers?: string[];
        };
        /** Semantic intention: describes what the compiled product should achieve. Used by AI during Verify. */
        vision?: string;
        /** Auto-fix mode: 'suggest' (default) = list proposed edits; 'auto' = directly edit the product file. */
        fix?: 'suggest' | 'auto';
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
        doc?: {
            targetLangs?: string[];
        };
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
