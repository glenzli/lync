import * as yaml from 'yaml';

export interface ParsedFrontmatter {
    data: Record<string, any>;
    content: string;
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseFrontmatter(source: string): ParsedFrontmatter {
    const match = FRONTMATTER_RE.exec(source);
    if (!match) {
        return { data: {}, content: source };
    }

    let data: unknown;
    try {
        data = yaml.parse(match[1]);
    } catch {
        data = {};
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        data = {};
    }

    return {
        data: data as Record<string, any>,
        content: source.slice(match[0].length),
    };
}

export function stringifyFrontmatter(content: string, data: Record<string, any>): string {
    const matter = yaml.stringify(data).trimEnd();
    const body = content.startsWith('\n') ? content : `\n${content}`;
    return `---\n${matter}\n---${body}`;
}
