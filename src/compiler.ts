import * as fs from 'fs';
import * as path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toMarkdown } from 'mdast-util-to-markdown';
import { visitParents } from 'unist-util-visit-parents';
import { loadLockfile } from './config';
import { Root, Link, Parent } from 'mdast';

/**
 * Compiles a specific `.src.md` file.
 * Expands `@import:inline` nodes and rewrites `@import:link` nodes.
 */
export async function compileFile(filePath: string, outPath?: string, callStack: Set<string> = new Set()): Promise<string> {
    if (callStack.has(filePath)) {
        throw new Error(`[FATAL] Circular dependency detected:\n  -> ${Array.from(callStack).join('\n  -> ')}\n  -> ${filePath} (Loop!)`);
    }
    callStack.add(filePath);

    const rawContent = fs.readFileSync(filePath, 'utf8');

    const processor = unified().use(remarkParse);
    const ast = processor.parse(rawContent) as Root;

    const lock = loadLockfile(process.cwd());

    const inlineNodes: { ancestors: Parent[], link: Link }[] = [];
    const linkNodes: { link: Link }[] = [];

    visitParents(ast, 'link', (node: Link, ancestors: Parent[]) => {
        if (node.url && node.url.startsWith('lync:')) {
            const alias = node.url.replace('lync:', '');
            const directive = node.title || '';

            if (directive.includes('@import:inline')) {
                // clone ancestors array
                inlineNodes.push({ ancestors: [...ancestors], link: node });
            } else if (directive.includes('@import:link')) {
                linkNodes.push({ link: node });
            } else {
                console.warn(`[WARN] Unrecognized directive for alias '${alias}': ${directive}`);
            }
        }
    });

    // 1. Process @import:link
    for (const item of linkNodes) {
        const alias = item.link.url.replace('lync:', '');
        const lockedDep = lock.dependencies[alias];
        if (!lockedDep) {
            throw new Error(`[FATAL] Unresolved alias '${alias}'. Please run 'lync add' or 'lync sync'.`);
        }

        const lockedDestPath = lockedDep.dest
            ? path.resolve(process.cwd(), lockedDep.dest)
            : path.resolve(process.cwd(), '.lync', alias + '.md');

        const relativeFrom = outPath ? path.dirname(outPath) : process.cwd();
        let relativeUrl = path.relative(relativeFrom, lockedDestPath);
        if (!relativeUrl.startsWith('.')) {
            relativeUrl = './' + relativeUrl;
        }

        if (item.link.title === '@import:link') {
            item.link.title = null;
        } else if (item.link.title) {
            item.link.title = item.link.title.replace('@import:link', '').trim();
        }
        item.link.url = relativeUrl;
    }

    // 2. Process @import:inline
    for (let i = inlineNodes.length - 1; i >= 0; i--) {
        const item = inlineNodes[i];
        const alias = item.link.url.replace('lync:', '');
        const lockedDep = lock.dependencies[alias];

        if (!lockedDep) {
            throw new Error(`[FATAL] Unresolved alias '${alias}'. Please run 'lync add' or 'lync sync'.`);
        }

        const lockedDestPath = lockedDep.dest
            ? path.resolve(process.cwd(), lockedDep.dest)
            : path.resolve(process.cwd(), '.lync', alias + '.md');

        if (!fs.existsSync(lockedDestPath)) {
            throw new Error(`[FATAL] Missing physical file for '${alias}'. Did you forget to 'lync sync'?`);
        }

        const expandedText = await compileFile(lockedDestPath, outPath, callStack);
        const subAst = processor.parse(expandedText) as Root;

        // Determine how to inject the subAst into the parent.
        // If the immediate parent is a paragraph, replacing the Link with Blocks (like deep headers) might cause mdast serialization failure.
        // So we find the block-level parent (e.g. paragraph) and its parent (e.g. root) to swap it completely.
        const immediateParent = item.ancestors[item.ancestors.length - 1];
        const grandParent = item.ancestors.length > 1 ? item.ancestors[item.ancestors.length - 2] : null;

        if (immediateParent.type === 'paragraph' && grandParent) {
            // Is the link the only meaningful content in the paragraph?
            const siblingNodes = immediateParent.children.filter(c => c.type !== 'text' || (c as any).value.trim() !== '');
            if (siblingNodes.length === 1 && siblingNodes[0] === item.link) {
                // Replace the entire paragraph with the injected blocks
                const pIndex = grandParent.children.indexOf(immediateParent as any);
                if (pIndex !== -1) {
                    grandParent.children.splice(pIndex, 1, ...subAst.children as any);
                }
            } else {
                // Inline injection inside paragraph (might break if subAst has Blocks)
                const lIndex = immediateParent.children.indexOf(item.link as any);
                if (lIndex !== -1) {
                    immediateParent.children.splice(lIndex, 1, ...subAst.children as any);
                }
            }
        } else {
            // Fallback inline injection
            const lIndex = immediateParent.children.indexOf(item.link as any);
            if (lIndex !== -1) {
                immediateParent.children.splice(lIndex, 1, ...subAst.children as any);
            }
        }
    }

    callStack.delete(filePath);
    return toMarkdown(ast);
}
