export interface LyncLLMConfig {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
}

export interface DependencyConfig {
    url?: string;
    dest?: string;
}

export type DependencyDeclaration = string | DependencyConfig;

export interface LyncConfig {
    dependencies?: Record<string, DependencyDeclaration>;
}

export interface LockDependency {
    url: string;
    dest?: string;
    version?: string;
    hash: string;
    fetchedAt: string;
}

export interface LyncLock {
    version: number;
    dependencies: Record<string, LockDependency>;
}

export interface BuildRoutingRule {
    match: string;
    dest: string;
}

export interface LyncBuild {
    includes?: string[];
    outDir?: string;
    output?: {
        dir?: string;
        flat?: boolean;
        inPlace?: boolean;
    };
    baseDir?: string;
    targetLangs?: string[];
    routing?: BuildRoutingRule[];
}
