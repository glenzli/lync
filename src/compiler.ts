import * as fs from 'fs';
import * as path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import { toMarkdown } from 'mdast-util-to-markdown';
import { frontmatterToMarkdown } from 'mdast-util-frontmatter';
import { directiveToMarkdown } from 'mdast-util-directive';
import { visitParents } from 'unist-util-visit-parents';
import { visit } from 'unist-util-visit';
import { detectLanguage, iso639_3_map, estimateTokens } from './utils';
import { loadLockfile } from './config';
import { Root, Link, Parent } from 'mdast';
import { translateMarkdownContent } from './translate';
import { t } from './i18n';

/**
 * Pre-scans a Markdown file to extract all unique language markers defined in `<!-- lang:xx -->` HTML comments.
 */
export function extractTargetLangs(filePath: string): string[] {
    if (!fs.existsSync(filePath)) return [];

    const rawContent = fs.readFileSync(filePath, 'utf8');
    const langs = new Set<string>();

    // Use regex to find all <!-- lang:xx --> markers
    const langRegex = /<!--\s*lang:([a-zA-Z-]+)\s*-->/g;
    let match;
    while ((match = langRegex.exec(rawContent)) !== null) {
        langs.add(match[1]);
    }

    return Array.from(langs);
}

export async function compileFile(filePath: string, outPath?: string, callStack: Set<string> = new Set(), targetLang?: string, agentMode?: boolean): Promise<string> {
    if (callStack.has(filePath)) {
        throw new Error(`[FATAL] Circular dependency detected:\n  -> ${Array.from(callStack).join('\n  -> ')}\n  -> ${filePath} (Loop!)`);
    }
    callStack.add(filePath);

    let rawContent = fs.readFileSync(filePath, 'utf8');

    // ----- HTML Comment Language Block Processing -----
    if (targetLang) {
        const langMarker = `<!-- lang:${targetLang} -->`;
        const langEndMarker = `<!-- /lang -->`;

        if (rawContent.includes('<!-- lang:')) {
            // Check if our specific target language exists
            if (rawContent.includes(langMarker)) {
                console.log(t('COMPILER_USE_EXISTING_BLOCK', targetLang, filePath));

                // 1. Identify all language blocks
                // 2. Keep only the requested one (stripping markers)
                // 3. Remove all other language blocks

                // Simple pattern: find all blocks and filter
                const allBlocksRegex = /<!--\s*lang:([a-zA-Z-]+)\s*-->([\s\S]*?)<!--\s*\/lang\s*-->/g;
                let processedContent = rawContent;
                let match;
                const replacements: { start: number, end: number, content: string }[] = [];

                while ((match = allBlocksRegex.exec(rawContent)) !== null) {
                    const blockLang = match[1];
                    const innerContent = match[2];
                    if (blockLang.toLowerCase() === targetLang.toLowerCase()) {
                        replacements.push({ start: match.index, end: match.index + match[0].length, content: innerContent });
                    } else {
                        replacements.push({ start: match.index, end: match.index + match[0].length, content: '' });
                    }
                }

                // Apply replacements from back to front to maintain indices
                for (let i = replacements.length - 1; i >= 0; i--) {
                    const r = replacements[i];
                    processedContent = processedContent.substring(0, r.start) + r.content + processedContent.substring(r.end);
                }
                rawContent = processedContent;
            } else {
                // Fallback Translation
                const firstBlockMatch = /<!--\s*lang:([a-zA-Z-]+)\s*-->([\s\S]*?)<!--\s*\/lang\s*-->/.exec(rawContent);
                if (firstBlockMatch) {
                    const sourceContentToTranslate = firstBlockMatch[2].trim();

                    let translatedText = sourceContentToTranslate;
                    if (agentMode) {
                        console.log(`[COMPILER] 🤖 Agent Mode: Bypassing fallback translation for '${targetLang}' in ${filePath}`);
                    } else {
                        console.log(t('COMPILER_TRANS_START', targetLang, filePath));
                        const translatedResult = await translateMarkdownContent(sourceContentToTranslate, targetLang);
                        if (translatedResult) {
                            if (translatedResult.usage) {
                                const inTokens = translatedResult.usage.inputTokens ?? 0;
                                const outTokens = translatedResult.usage.outputTokens ?? 0;
                                const totalTokens = translatedResult.usage.totalTokens ?? (inTokens + outTokens);
                                console.log(t('COMPILER_TRANS_TOKENS', inTokens, outTokens, totalTokens));
                            }
                            translatedText = translatedResult.text;
                        }
                    }

                    // Replace all blocks: first one with translation, others with empty
                    const allBlocksRegex = /<!--\s*lang:([a-zA-Z-]+)\s*-->([\s\S]*?)<!--\s*\/lang\s*-->/g;
                    let processedContent = rawContent;
                    let match;
                    const replacements: { start: number, end: number, content: string }[] = [];
                    let first = true;

                    while ((match = allBlocksRegex.exec(rawContent)) !== null) {
                        if (first) {
                            replacements.push({ start: match.index, end: match.index + match[0].length, content: translatedText });
                            first = false;
                        } else {
                            replacements.push({ start: match.index, end: match.index + match[0].length, content: '' });
                        }
                    }

                    for (let i = replacements.length - 1; i >= 0; i--) {
                        const r = replacements[i];
                        processedContent = processedContent.substring(0, r.start) + r.content + processedContent.substring(r.end);
                    }
                    rawContent = processedContent;
                }
            }
        } else {
            // Legacy/Global Mode (entire file)

            // Check if it's a pure routing module (only headings, @import:inline links, and punctuation/formatting)
            const contentWithoutFrontmatter = rawContent.replace(/^---\n[\s\S]*?\n---/, '');
            const contentWithoutImportsAndHeadings = contentWithoutFrontmatter
                .replace(/\[[^\]]*\]\([^)]*["']@import:inline["'][^)]*\)/g, '')  // strip inline imports
                .replace(/^#{1,6}\s+.*$/gm, '');                                  // strip heading lines
            const pureAlphaNum = contentWithoutImportsAndHeadings.replace(/[^a-zA-Z\u4e00-\u9fa50-9]/g, '');

            let nlpSkipped = false;
            if (pureAlphaNum.length === 0) {
                console.log(t('COMPILER_ROUTER_SKIP', targetLang));
                nlpSkipped = true;
            } else {
                // Determine if it actually needs translation (NLP)
                const detected = detectLanguage(rawContent);
                if (detected) {
                    const mappedTargets = iso639_3_map[detected] || [detected];
                    if (mappedTargets.includes(targetLang.toLowerCase()) || detected.toLowerCase() === targetLang.toLowerCase()) {
                        console.log(t('COMPILER_NLP_SKIP', targetLang));
                        nlpSkipped = true;
                    }
                }
            }

            if (!nlpSkipped) {
                if (agentMode) {
                    console.log(`[COMPILER] 🤖 Agent Mode: Bypassing NLP translation for '${targetLang}'`);
                } else {
                    console.log(t('COMPILER_TRANS_FULL', targetLang));
                    const translatedResult = await translateMarkdownContent(rawContent, targetLang);
                    if (translatedResult) {
                        rawContent = translatedResult.text;
                    }
                }
            }
        }
    }
    // -------------------------------------------------------

    const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml']);

    const ast = processor.parse(rawContent) as Root;

    // ----- [NEW] Frontmatter Stripping -----
    if (ast.children) {
        ast.children = ast.children.filter(node => node.type !== 'yaml');
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

        const expandedText = await compileFile(lockedDestPath, outPath, callStack, targetLang, agentMode);
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

    // Rewrite .lync.md references in regular links to .md
    visitParents(ast, 'link', (node: Link) => {
        if (node.url && node.url.endsWith('.lync.md')) {
            node.url = node.url.replace(/\.lync\.md$/, '.md');
        }
    });

    const output = toMarkdown(ast, { extensions: [frontmatterToMarkdown(['yaml'])] });

    // Only check tokens for the root assembled file
    if (callStack.size === 0) {
        const tokens = estimateTokens(output);
        if (tokens > 20000) {
            console.warn(t('WARN_TOKEN_LIMIT', tokens));
        }
    }

    return output;
}
