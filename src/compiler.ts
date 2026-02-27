import * as fs from 'fs';
import * as path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import { toMarkdown } from 'mdast-util-to-markdown';
import { frontmatterToMarkdown } from 'mdast-util-frontmatter';
import { visitParents } from 'unist-util-visit-parents';
import { visit } from 'unist-util-visit';
import { loadLockfile } from './config';
import { Root, Link, Parent } from 'mdast';
import { translateMarkdownContent } from './translate';

/**
 * Pre-scans a Markdown file to extract all unique language markers defined in `:::lang` block directives.
 */
export function extractTargetLangs(filePath: string): string[] {
    if (!fs.existsSync(filePath)) return [];

    const rawContent = fs.readFileSync(filePath, 'utf8');
    const processor = unified()
        .use(remarkParse)
        .use(remarkDirective);

    const ast = processor.parse(rawContent) as Root;
    const langs = new Set<string>();

    visit(ast, 'containerDirective', (node: any) => {
        const name = node.name as string;
        let blockLang = '';
        if (name.startsWith('lang=')) {
            blockLang = name.substring(5);
        } else if (name === 'lang') {
            blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
        }
        if (!blockLang && name && name !== 'lang') {
            blockLang = name; // Fallback for :::zh-CN
        }

        if (blockLang) {
            langs.add(blockLang);
        }
    });

    return Array.from(langs);
}

/**
 * Compiles a specific `.lync.md` file.
 * Expands `@import:inline` nodes and rewrites `@import:link` nodes.
 */
export async function compileFile(filePath: string, outPath?: string, callStack: Set<string> = new Set(), targetLang?: string): Promise<string> {
    if (callStack.has(filePath)) {
        throw new Error(`[FATAL] Circular dependency detected:\n  -> ${Array.from(callStack).join('\n  -> ')}\n  -> ${filePath} (Loop!)`);
    }
    callStack.add(filePath);

    const rawContent = fs.readFileSync(filePath, 'utf8');

    const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml']) // Parse YAML frontmatter nodes
        .use(remarkDirective); // Parse :::lang=... directives

    const ast = processor.parse(rawContent) as Root;

    // ----- [NEW] Frontmatter Stripping -----
    if (ast.children) {
        ast.children = ast.children.filter(node => node.type !== 'yaml');
    }
    // ---------------------------------------

    // ----- [NEW] Multilingual i18n AST Filtering & Translation -----
    if (targetLang) {
        let hasLangDirectives = false;
        let hasTargetLangBlock = false;
        let firstAvailableLangBlock: any = null;

        visit(ast, 'containerDirective', (node: any) => {
            const name = node.name as string;
            let blockLang = '';
            if (name.startsWith('lang=')) {
                blockLang = name.substring(5);
            } else if (name === 'lang') {
                blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
            }
            if (!blockLang && name && name !== 'lang') {
                blockLang = name; // Fallback for :::zh-CN
            }

            if (blockLang) {
                hasLangDirectives = true;
                if (!firstAvailableLangBlock) firstAvailableLangBlock = node;
                if (blockLang.toLowerCase() === targetLang.toLowerCase()) {
                    hasTargetLangBlock = true;
                }
            }
        });

        if (hasLangDirectives) {
            if (hasTargetLangBlock) {
                let offset = 0;
                visit(ast, 'containerDirective', (node: any, index: number, parent: any) => {
                    const name = node.name as string;
                    let blockLang = '';
                    if (name.startsWith('lang=')) {
                        blockLang = name.substring(5);
                    } else if (name === 'lang') {
                        blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
                    }
                    if (!blockLang && name && name !== 'lang') blockLang = name;

                    if (blockLang) {
                        if (blockLang.toLowerCase() === targetLang.toLowerCase()) {
                            parent.children.splice(index, 1, ...node.children);
                            return ['skip', index];
                        } else {
                            parent.children.splice(index, 1);
                            return ['skip', index];
                        }
                    }
                });
            } else {
                const rootWrapper: Root = { type: 'root', children: firstAvailableLangBlock.children };
                const sourceContentToTranslate = toMarkdown(rootWrapper, { extensions: [frontmatterToMarkdown(['yaml'])] });
                console.log(`[COMPILER] 🌐 Target language '${targetLang}' not found in blocks. Translating fallback block...`);

                const translatedMarkdown = await translateMarkdownContent(sourceContentToTranslate, targetLang);
                if (translatedMarkdown) {
                    const translatedAst = processor.parse(translatedMarkdown) as Root;
                    visit(ast, 'containerDirective', (node: any, index: number, parent: any) => {
                        const name = node.name as string;
                        let blockLang = '';
                        if (name.startsWith('lang=')) blockLang = name.substring(5);
                        else if (name === 'lang') blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
                        if (!blockLang && name && name !== 'lang') blockLang = name;

                        if (blockLang) {
                            if (node === firstAvailableLangBlock) {
                                parent.children.splice(index, 1, ...translatedAst.children);
                                return ['skip', index + translatedAst.children.length];
                            } else {
                                parent.children.splice(index, 1);
                                return ['skip', index];
                            }
                        }
                    });
                } else {
                    console.warn(`[WARN] Translation to '${targetLang}' failed. Using fallback language block as-is.`);
                    visit(ast, 'containerDirective', (node: any, index: number, parent: any) => {
                        const name = node.name as string;
                        let blockLang = '';
                        if (name.startsWith('lang=')) blockLang = name.substring(5);
                        else if (name === 'lang') blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
                        if (!blockLang && name && name !== 'lang') blockLang = name;

                        if (blockLang) {
                            if (node === firstAvailableLangBlock) {
                                parent.children.splice(index, 1, ...node.children);
                                return ['skip', index + node.children.length];
                            } else {
                                parent.children.splice(index, 1);
                                return ['skip', index];
                            }
                        }
                    });
                }
            }
        } else {
            // Legacy Mode
            const sourceContent = toMarkdown(ast, { extensions: [frontmatterToMarkdown(['yaml'])] });
            console.log(`[COMPILER] 🌐 Legacy module detected. Translating the entire content to '${targetLang}'...`);
            const translatedMarkdown = await translateMarkdownContent(sourceContent, targetLang);
            if (translatedMarkdown) {
                const translatedAst = processor.parse(translatedMarkdown) as Root;
                ast.children = translatedAst.children;
            } else {
                console.warn(`[WARN] Translation of legacy module to '${targetLang}' failed. Proceeding with original content.`);
            }
        }
    }
    // ---------------------------------------

    const lock = loadLockfile(process.cwd());

    const inlineNodes: { ancestors: Parent[], link: Link }[] = [];
    const linkNodes: { link: Link }[] = [];

    visitParents(ast, 'link', (node: Link, ancestors: Parent[]) => {
        const isLyncAlias = node.url && node.url.startsWith('lync:');
        const isRelative = node.url && (node.url.startsWith('./') || node.url.startsWith('../'));

        if (isLyncAlias || isRelative) {
            const directive = node.title || '';

            if (directive.includes('@import:inline')) {
                // clone ancestors array
                inlineNodes.push({ ancestors: [...ancestors], link: node });
            } else if (directive.includes('@import:link')) {
                linkNodes.push({ link: node });
            } else if (isLyncAlias) {
                console.warn(`[WARN] Unrecognized directive for alias '${node.url}': ${directive}`);
            }
        }
    });

    // 1. Process @import:link
    for (const item of linkNodes) {
        let lockedDestPath: string;

        if (item.link.url.startsWith('lync:')) {
            const alias = item.link.url.replace('lync:', '');
            const lockedDep = lock.dependencies[alias];
            if (!lockedDep) {
                throw new Error(`[FATAL] Unresolved alias '${alias}'. Please run 'lync add' or 'lync sync'.`);
            }
            lockedDestPath = lockedDep.dest
                ? path.resolve(process.cwd(), lockedDep.dest)
                : path.resolve(process.cwd(), '.lync', alias + '.md');
        } else {
            // It's a relative local file
            lockedDestPath = path.resolve(path.dirname(filePath), item.link.url);
        }

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
        let lockedDestPath: string;
        let resolveName: string;

        if (item.link.url.startsWith('lync:')) {
            const alias = item.link.url.replace('lync:', '');
            resolveName = alias;
            const lockedDep = lock.dependencies[alias];

            if (!lockedDep) {
                throw new Error(`[FATAL] Unresolved alias '${alias}'. Please run 'lync add' or 'lync sync'.`);
            }

            lockedDestPath = lockedDep.dest
                ? path.resolve(process.cwd(), lockedDep.dest)
                : path.resolve(process.cwd(), '.lync', alias + '.md');
        } else {
            resolveName = item.link.url;
            lockedDestPath = path.resolve(path.dirname(filePath), resolveName);
        }

        if (!fs.existsSync(lockedDestPath)) {
            throw new Error(`[FATAL] Missing physical file for '${resolveName}'. Cannot import inline.`);
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
    return toMarkdown(ast, { extensions: [frontmatterToMarkdown(['yaml'])] });
}
