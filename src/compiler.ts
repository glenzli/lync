import * as fs from 'fs';
import * as path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toMarkdown } from 'mdast-util-to-markdown';
import { visit } from 'unist-util-visit';
import { loadLockfile } from './config';
import { Root, Link } from 'mdast';

/**
 * Compiles a specific `.src.md` file.
 * Expands `@import:inline` nodes and rewrites `@import:link` nodes.
 * @param filePath The absolute path to the source file.
 * @param outPath The absolute path where the final file will be written (used for relative link calculation).
 * @param callStack A set tracking the current compilation chain to prevent circular references.
 */
export async function compileFile(filePath: string, outPath?: string, callStack: Set<string> = new Set()): Promise<string> {
    if (callStack.has(filePath)) {
        throw new Error(`[FATAL] Circular dependency detected:\n  -> ${Array.from(callStack).join('\n  -> ')}\n  -> ${filePath} (Loop!)`);
    }
    callStack.add(filePath);

    const rawContent = fs.readFileSync(filePath, 'utf8');

    // Parse original file into an AST
    const processor = unified().use(remarkParse);
    const ast = processor.parse(rawContent) as Root;

    const lock = loadLockfile(process.cwd());

    // Deep clone to prevent unintended side effects if needed (though we rewrite in-place here)

    // We need to support async visitor because inline expansion requires parsing the sub-file asynchronously.
    // unist-util-visit is synchronous. We must collect nodes to modify first.
    const inlineNodes: { parent: any, index: number, link: Link }[] = [];
    const linkNodes: { link: Link }[] = [];

    visit(ast, 'link', (node: Link, index, parent) => {
        if (node.url && node.url.startsWith('lync:')) {
            const alias = node.url.replace('lync:', '');
            const directive = node.title || '';

            if (directive.includes('@import:inline')) {
                inlineNodes.push({ parent, index: index!, link: node });
            } else if (directive.includes('@import:link')) {
                linkNodes.push({ link: node });
            } else {
                console.warn(`[WARN] Unrecognized directive for alias '${alias}': ${directive}`);
            }
        }
    });

    // 1. Process @import:link (Synchronously simple)
    for (const item of linkNodes) {
        const alias = item.link.url.replace('lync:', '');
        const lockedDep = lock.dependencies[alias];
        if (!lockedDep) {
            throw new Error(`[FATAL] Unresolved alias '${alias}'. Please run 'lync add' or 'lync sync'.`);
        }

        const lockedDestPath = lockedDep.dest
            ? path.resolve(process.cwd(), lockedDep.dest)
            : path.resolve(process.cwd(), '.lync', alias + '.md');

        // Rewrite URL relative to the output path (or current working directory if not specified)
        const relativeFrom = outPath ? path.dirname(outPath) : process.cwd();
        let relativeUrl = path.relative(relativeFrom, lockedDestPath);
        if (!relativeUrl.startsWith('.')) {
            relativeUrl = './' + relativeUrl;
        }

        // Clear title if it solely contained the directive.
        if (item.link.title === '@import:link') {
            item.link.title = null;
        } else if (item.link.title) {
            item.link.title = item.link.title.replace('@import:link', '').trim();
        }
        item.link.url = relativeUrl;
    }

    // 2. Process @import:inline (Asynchronous/Recursive step)
    // We process in reverse order to not mess up indices if we insert multiple nodes.
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

        // Recursively compile the dependency. Pass down the callStack!
        // Since we are compiling a dependency for inline expansion, we don't care about its outPath for link resolution,
        // assuming inline content should be entirely flattened raw text.
        // However, if the inline text itself contains @import:link, they will be relative to THIS file's outPath!
        const expandedText = await compileFile(lockedDestPath, outPath, callStack);

        // Parse the expanded text into a subtree
        const subAst = processor.parse(expandedText) as Root;

        // Inject children of the subtree into the parent at the link's index
        item.parent.children.splice(item.index, 1, ...subAst.children);
    }

    // Backtrack call stack after fully parsing this file's tree
    callStack.delete(filePath);

    // Serialize back to raw text
    return toMarkdown(ast);
}
