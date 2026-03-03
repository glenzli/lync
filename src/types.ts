export interface VasmLLMConfig {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
}

export interface VasmRc {
    lang?: string;
    llm?: VasmLLMConfig;
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
        compile?: {
            format?: 'doc' | 'prompt';
            targetLangs?: string[];
        };
        dependencies?: Record<string, DependencyDeclaration>;
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
}
