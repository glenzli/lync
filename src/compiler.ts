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
import { francAll } from 'franc-min';

const iso639_3_map: Record<string, string[]> = {
    'cmn': ['zh', 'zh-cn', 'zh-tw', 'zh-hk'],
    'eng': ['en', 'en-us', 'en-gb'],
    'jpn': ['ja'],
    'spa': ['es'],
    'fra': ['fr'],
    'deu': ['de'],
    'rus': ['ru'],
    'kor': ['ko'],
    'ita': ['it'],
    'por': ['pt', 'pt-br']
};
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

        // Custom visitor due to remark-directive often failing to generate containerDirective AST nodes 
        // silently during processor.parse() depending on exact plugin versions and micromark bindings.
        visit(ast, (node: any) => {
            // Check native `containerDirective` nodes (if they actually parsed)
            if (node.type === 'containerDirective') {
                const name = node.name as string;
                let blockLang = '';
                if (name.startsWith('lang=')) blockLang = name.substring(5);
                else if (name === 'lang') blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
                if (!blockLang && name && name !== 'lang') blockLang = name; // Fallback

                if (blockLang) {
                    hasLangDirectives = true;
                    if (!firstAvailableLangBlock) firstAvailableLangBlock = node;
                    if (blockLang.toLowerCase() === targetLang.toLowerCase()) hasTargetLangBlock = true;
                }
            }
            // Fallback checking if it was parsed as plain text
            else if (node.type === 'text' && node.value && node.value.includes(':::lang=')) {
                hasLangDirectives = true;
                const targetMatch = new RegExp(`:::lang=${targetLang}`, 'i');
                if (targetMatch.test(node.value) || new RegExp(`:::${targetLang}`, 'i').test(node.value)) {
                    hasTargetLangBlock = true;
                }
                if (!firstAvailableLangBlock) firstAvailableLangBlock = node;
            }
        });

        if (hasLangDirectives) {
            if (hasTargetLangBlock) {
                console.log(`[COMPILER] ⚡️ Using existing '${targetLang}' block for ${filePath}`);
                let offset = 0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                visit(ast, (node: any, index: number | undefined, parent: any) => {
                    if (index === undefined) return;

                    let blockLang = '';
                    let isTextNode = false;

                    if (node.type === 'containerDirective') {
                        const name = node.name as string;
                        if (name.startsWith('lang=')) blockLang = name.substring(5);
                        else if (name === 'lang') blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
                        if (!blockLang && name && name !== 'lang') blockLang = name;
                    } else if (node.type === 'text' && node.value && node.value.includes(':::lang=')) {
                        const match = node.value.match(/:::lang=([^\n:]+)/i);
                        const matchShort = node.value.match(/:::([a-zA-Z-]+)/i);
                        if (match) blockLang = match[1].trim();
                        else if (matchShort && matchShort[1] !== 'lang') blockLang = matchShort[1].trim();
                        if (blockLang) isTextNode = true;
                    }

                    if (blockLang) {
                        if (blockLang.toLowerCase() === targetLang.toLowerCase()) {
                            if (isTextNode) {
                                // Extract the inner content from the pseudo-directive text
                                const innerText = node.value.replace(/:::lang=[^\n:]+\n+/, '').replace(/\n+:::$/, '');
                                const innerAst = processor.parse(innerText) as Root;
                                parent.children.splice(index, 1, ...innerAst.children);
                                return ['skip', index + innerAst.children.length];
                            } else {
                                parent.children.splice(index, 1, ...node.children);
                                return ['skip', index + node.children.length];
                            }
                        } else {
                            parent.children.splice(index, 1);
                            return ['skip', index];
                        }
                    }
                });
            } else {
                let sourceContentToTranslate = '';
                if (firstAvailableLangBlock.type === 'text') {
                    // Extract the inner content from the pseudo-directive text
                    sourceContentToTranslate = firstAvailableLangBlock.value.replace(/:::lang=[^\n:]+\n+/, '').replace(/\n+:::$/, '');
                } else {
                    const rootWrapper: Root = { type: 'root', children: firstAvailableLangBlock.children };
                    sourceContentToTranslate = toMarkdown(rootWrapper, { extensions: [frontmatterToMarkdown(['yaml']), directiveToMarkdown()] });
                }

                console.log(`[COMPILER] 🌐 Target language '${targetLang}' not found in blocks. Translating fallback block...`);

                const translatedResult = await translateMarkdownContent(sourceContentToTranslate, targetLang);
                if (translatedResult) {
                    if (translatedResult.usage) {
                        const inTokens = translatedResult.usage.inputTokens ?? 0;
                        const outTokens = translatedResult.usage.outputTokens ?? 0;
                        const totalTokens = translatedResult.usage.totalTokens ?? (inTokens + outTokens);
                        console.log(`[TRANSLATE] 📊 Tokens used: ${inTokens} prompt + ${outTokens} completion = ${totalTokens} total`);
                    }
                    const translatedAst = processor.parse(translatedResult.text) as Root;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    visit(ast, (node: any, index: number | undefined, parent: any) => {
                        if (index === undefined) return;

                        let blockLang = '';
                        let isTextNode = false;

                        if (node.type === 'containerDirective') {
                            const name = node.name as string;
                            if (name.startsWith('lang=')) blockLang = name.substring(5);
                            else if (name === 'lang') blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
                            if (!blockLang && name && name !== 'lang') blockLang = name;
                        } else if (node.type === 'text' && node.value && node.value.includes(':::lang=')) {
                            const match = node.value.match(/:::lang=([^\n:]+)/i);
                            const matchShort = node.value.match(/:::([a-zA-Z-]+)/i);
                            if (match) blockLang = match[1].trim();
                            else if (matchShort && matchShort[1] !== 'lang') blockLang = matchShort[1].trim();
                            if (blockLang) isTextNode = true;
                        }

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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    visit(ast, (node: any, index: number | undefined, parent: any) => {
                        if (index === undefined) return;

                        let blockLang = '';
                        let isTextNode = false;

                        if (node.type === 'containerDirective') {
                            const name = node.name as string;
                            if (name.startsWith('lang=')) blockLang = name.substring(5);
                            else if (name === 'lang') blockLang = node.attributes?.id || node.attributes?.lang || (node.attributes && Object.keys(node.attributes)[0]);
                            if (!blockLang && name && name !== 'lang') blockLang = name;
                        } else if (node.type === 'text' && node.value && node.value.includes(':::lang=')) {
                            const match = node.value.match(/:::lang=([^\n:]+)/i);
                            const matchShort = node.value.match(/:::([a-zA-Z-]+)/i);
                            if (match) blockLang = match[1].trim();
                            else if (matchShort && matchShort[1] !== 'lang') blockLang = matchShort[1].trim();
                            if (blockLang) isTextNode = true;
                        }

                        if (blockLang) {
                            if (node === firstAvailableLangBlock) {
                                if (isTextNode) {
                                    const innerText = node.value.replace(/:::lang=[^\n:]+\n+/, '').replace(/\n+:::$/, '');
                                    const innerAst = processor.parse(innerText) as Root;
                                    parent.children.splice(index, 1, ...innerAst.children);
                                    return ['skip', index + innerAst.children.length];
                                } else {
                                    parent.children.splice(index, 1, ...node.children);
                                    return ['skip', index + node.children.length];
                                }
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
            let hasText = false;
            let accumulatedProse = '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            visit(ast, 'text', (node: any, index: number | undefined, parent: any) => {
                if (parent && parent.type === 'link') return;
                if (parent && parent.type === 'image') return;

                if (node.value) {
                    accumulatedProse += node.value + ' ';
                }

                // RegExp matches basic Latin, Numbers, and common CJK block characters
                if (/[a-zA-Z0-9\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7a3]/.test(node.value)) {
                    hasText = true;
                }
            });

            if (!hasText) {
                console.log(`[COMPILER] ⚡️ Aggregator detected (No translatable prose). Skipping LLM translation for '${targetLang}'.`);
            } else {
                let nlpSkipped = false;
                const topLanguages = francAll(accumulatedProse);
                if (topLanguages.length > 0) {
                    const topGuess = topLanguages[0];
                    const langCode = topGuess[0];
                    const confidence = topGuess[1] as number;

                    const mappedTargets = iso639_3_map[langCode] || [];
                    if (confidence > 0.4 && mappedTargets.includes(targetLang.toLowerCase())) {
                        console.log(`[COMPILER] ⚡️ NLP detected source is already '${targetLang}' (Score: ${(confidence * 100).toFixed(0)}%). Skipping LLM translation.`);
                        nlpSkipped = true;
                    }
                }

                if (!nlpSkipped) {
                    const sourceContent = toMarkdown(ast, { extensions: [frontmatterToMarkdown(['yaml']), directiveToMarkdown()] });
                    console.log(`[COMPILER] 🌐 Legacy module detected. Translating the entire content to '${targetLang}'...`);
                    const translatedResult = await translateMarkdownContent(sourceContent, targetLang);
                    if (translatedResult) {
                        if (translatedResult.usage) {
                            const inTokens = translatedResult.usage.inputTokens ?? 0;
                            const outTokens = translatedResult.usage.outputTokens ?? 0;
                            const totalTokens = translatedResult.usage.totalTokens ?? (inTokens + outTokens);
                            console.log(`[TRANSLATE] 📊 Tokens used: ${inTokens} prompt + ${outTokens} completion = ${totalTokens} total`);
                        }
                        const translatedAst = processor.parse(translatedResult.text) as Root;
                        ast.children = translatedAst.children;
                    } else {
                        console.warn(`[WARN] Translation of legacy module to '${targetLang}' failed. Proceeding with original content.`);
                    }
                }
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

        const expandedText = await compileFile(lockedDestPath, outPath, callStack, targetLang);
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
    return toMarkdown(ast, { extensions: [frontmatterToMarkdown(['yaml']), directiveToMarkdown()] });
}
