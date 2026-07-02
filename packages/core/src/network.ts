import * as crypto from 'crypto';

/**
 * Fetches the markdown content from a remote URL.
 * Implements a fail-fast strategy without complex retries.
 */
export async function fetchMarkdown(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}

/**
 * Computes a SHA-256 hash for the given text content.
 */
export function computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
}

export function normalizeHash(hash: string | undefined): string {
    return (hash || '').trim().replace(/^sha256:/i, '');
}

export function hashMatches(content: string, expectedHash: string | undefined): boolean {
    const normalizedExpected = normalizeHash(expectedHash);
    return normalizedExpected.length > 0 && computeHash(content) === normalizedExpected;
}
