import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';
import { fetchMarkdown, normalizeHash } from './network';
import type { DependencyDeclaration, LockDependency, VasmCatalog, VasmCatalogExport } from './types';

export interface NormalizedDependency {
    alias: string;
    kind: 'url' | 'catalog';
    url?: string;
    catalog?: string;
    exportName?: string;
    dest?: string;
}

export interface ResolvedCatalogDependency {
    artifactUrl: string;
    exportName: string;
    name: string;
    version: string;
    format: VasmCatalogExport['format'];
    hash: string;
}

function isRemoteReference(ref: string): boolean {
    return /^https?:\/\//i.test(ref);
}

function isFileUrl(ref: string): boolean {
    return /^file:\/\//i.test(ref);
}

function isAbsoluteReference(ref: string): boolean {
    return isRemoteReference(ref) || isFileUrl(ref) || path.isAbsolute(ref);
}

export function normalizeDependencyDeclaration(alias: string, declaration: DependencyDeclaration): NormalizedDependency {
    if (typeof declaration === 'string') {
        return { alias, kind: 'url', url: declaration };
    }

    if (!declaration || typeof declaration !== 'object') {
        return { alias, kind: 'url' };
    }

    if (declaration.catalog) {
        return {
            alias,
            kind: 'catalog',
            catalog: declaration.catalog,
            exportName: declaration.export || alias,
            dest: declaration.dest,
        };
    }

    return {
        alias,
        kind: 'url',
        url: declaration.url,
        dest: declaration.dest,
    };
}

export function resolveLockedDependencyPath(cwd: string, alias: string, lockedDep: Pick<LockDependency, 'dest'>): string {
    return lockedDep.dest
        ? path.resolve(cwd, lockedDep.dest)
        : path.resolve(cwd, '.vasmc', `${alias}.md`);
}

export function resolveDependencyTargetPath(cwd: string, alias: string, dependency: Pick<NormalizedDependency, 'dest'>): string {
    return dependency.dest
        ? path.resolve(cwd, dependency.dest)
        : path.resolve(cwd, '.vasmc', `${alias}.md`);
}

export function resolveReference(baseRef: string, targetRef: string): string {
    if (isAbsoluteReference(targetRef)) return targetRef;

    if (isRemoteReference(baseRef) || isFileUrl(baseRef)) {
        return new URL(targetRef, baseRef).toString();
    }

    const baseDir = path.dirname(baseRef);
    const resolved = path.normalize(path.join(baseDir, targetRef));
    return resolved.replace(/\\/g, '/');
}

export async function readReference(ref: string, cwd: string): Promise<string> {
    if (isRemoteReference(ref)) {
        return fetchMarkdown(ref);
    }

    const filePath = isFileUrl(ref)
        ? fileURLToPath(ref)
        : path.resolve(cwd, ref);
    return fs.readFileSync(filePath, 'utf8');
}

export async function resolveCatalogDependency(dependency: NormalizedDependency, cwd: string): Promise<ResolvedCatalogDependency> {
    if (dependency.kind !== 'catalog' || !dependency.catalog) {
        throw new Error(`Dependency '${dependency.alias}' is not a catalog dependency.`);
    }

    const exportName = dependency.exportName || dependency.alias;
    const catalogContent = await readReference(dependency.catalog, cwd);
    const catalog = yaml.parse(catalogContent) as VasmCatalog | null;
    const entry = catalog?.exports?.[exportName];

    if (!catalog || catalog.catalogVersion !== 1 || !catalog.exports) {
        throw new Error(`Catalog dependency '${dependency.alias}' does not point to a valid vasmc-catalog.yaml.`);
    }
    if (!entry) {
        throw new Error(`Catalog dependency '${dependency.alias}' cannot find export '${exportName}'.`);
    }
    if (!entry.file || !entry.hash || !entry.name || !entry.version || !entry.format) {
        throw new Error(`Catalog export '${exportName}' is incomplete.`);
    }
    if (isAbsoluteReference(entry.file) || entry.file.startsWith('../') || entry.file.includes('/../')) {
        throw new Error(`Catalog export '${exportName}' file must stay relative to the catalog.`);
    }
    if (!normalizeHash(entry.hash)) {
        throw new Error(`Catalog export '${exportName}' has an invalid hash.`);
    }

    return {
        artifactUrl: resolveReference(dependency.catalog, entry.file),
        exportName,
        name: entry.name,
        version: entry.version,
        format: entry.format,
        hash: entry.hash,
    };
}
