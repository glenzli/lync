import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { computeHash } from './network';
import type { ProjectReviewConfig } from './types';

export type ProjectReviewMode = 'suggest' | 'patch';

export interface ProjectReviewContextFile {
    path: string;
    bytes: number;
    hash: string;
    duplicates?: string[];
}

export interface ProjectReviewContext {
    version: 1;
    mode: ProjectReviewMode;
    generatedAt: string;
    files: ProjectReviewContextFile[];
    reviewGoals: string[];
}

export interface ProjectReviewReport {
    mode: ProjectReviewMode;
    contextFile: string;
    files: ProjectReviewContextFile[];
}

const defaultIncludes = [
    'README.md',
    'HELP.md',
    'DESIGN.md',
    'docs/**/*.md',
    'package.json',
    'packages/*/package.json',
    'vasmc.yaml',
    'vasmc-build.yaml',
    'docs-src/**/*.vasm.md',
    'packages/*/docs-src/**/*.vasm.md',
    'skill-src/**/*.vasm.md',
    'skill-src/**/*.md',
];

const defaultExcludes = [
    'node_modules/**',
    'dist/**',
    'packages/*/dist/**',
    '.git/**',
    '.vasmc/**',
];

export function normalizeProjectReviewMode(config?: ProjectReviewConfig): ProjectReviewMode | undefined {
    if (!config || config.mode === 'off') return undefined;
    return config.mode || 'suggest';
}

export async function createProjectReviewContext(cwd: string, config?: ProjectReviewConfig): Promise<ProjectReviewContext | undefined> {
    const mode = normalizeProjectReviewMode(config);
    if (!mode) return undefined;

    const includes = config?.include?.length ? config.include : defaultIncludes;
    const excludes = [...defaultExcludes, ...(config?.exclude || [])];
    const maxFiles = config?.maxFiles ?? 80;
    const maxFileBytes = config?.maxFileBytes ?? 200_000;

    const matches = await glob(includes, {
        cwd,
        nodir: true,
        ignore: excludes,
    });

    const uniqueMatches = [...new Set(matches)].sort((a, b) => a.length - b.length || a.localeCompare(b));
    const files: ProjectReviewContextFile[] = [];
    const filesByHash = new Map<string, ProjectReviewContextFile>();

    for (const relativePath of uniqueMatches) {
        if (files.length >= maxFiles) break;
        const absolutePath = path.resolve(cwd, relativePath);
        if (!fs.existsSync(absolutePath)) continue;
        const stat = fs.statSync(absolutePath);
        if (!stat.isFile() || stat.size > maxFileBytes) continue;
        const content = fs.readFileSync(absolutePath, 'utf8');
        const hash = computeHash(content);
        const existing = filesByHash.get(hash);
        if (existing) {
            existing.duplicates = [...(existing.duplicates || []), relativePath];
            continue;
        }
        files.push({
            path: relativePath,
            bytes: stat.size,
            hash,
        });
        filesByHash.set(hash, files[files.length - 1]);
    }

    return {
        version: 1,
        mode,
        generatedAt: new Date().toISOString(),
        files,
        reviewGoals: [
            'Check whether compiled prompts and skills reflect the current project structure, commands, terminology, and constraints.',
            'Suggest source-level changes only; do not edit generated outputs directly.',
            'Look for overly broad skill activation, capabilities that can be narrowed, duplicated fragments, stale project facts, and missing project-specific guidance.',
            mode === 'patch'
                ? 'If useful, provide focused patches against .vasm.md or docs-src files.'
                : 'Provide concise recommendations and ask before making source edits.',
        ],
    };
}

export function formatProjectReviewAction(itemIndex: number, contextFile: string, mode: ProjectReviewMode): string {
    const modeText = mode === 'patch'
        ? 'produce focused source patch proposals'
        : 'produce concise source-level recommendations';
    return `${itemIndex}. **Project Review** \`${contextFile}\` — read the context index and \`.vasmc/build-report.yaml\`; ${modeText}, never edit generated outputs directly`;
}
