/**
 * Fetches the markdown content from a remote URL.
 * Implements a fail-fast strategy without complex retries.
 */
export declare function fetchMarkdown(url: string): Promise<string>;
/**
 * Computes a SHA-256 hash for the given text content.
 */
export declare function computeHash(content: string): string;
//# sourceMappingURL=network.d.ts.map