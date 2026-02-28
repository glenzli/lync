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

export async function compileFile(filePath: string, outPath?: string, callStack: Set<string> = new Set(), targetLang?: string): Promise<string> {
    if (callStack.has(filePath)) {
        throw new Error(`[FATAL] Circular dependency detected:\n  -> ${Array.from(callStack).join('\n  -> ')}\n  -> ${filePath} (Loop!)`);
    }
    callStack.add(filePath);

    let rawContent = fs.readFileSync(filePath, 'utf8');

    // ----- [NEW v2] HTML Comment i18n Block Processing -----
    if (targetLang) {
        const langMarker = `<!-- lang:${targetLang} -->`;
        const langEndMarker = `<!-- /lang -->`;

        if (rawContent.includes('<!-- lang:')) {
            // Check if our specific target language exists
            if (rawContent.includes(langMarker)) {
                console.log(`[COMPILER] ⚡️ Using existing '${targetLang}' block for ${filePath}`);

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
                    console.log(`[COMPILER] 🌐 Target language '${targetLang}' not found in blocks. Translating fallback block...`);

                    const translatedResult = await translateMarkdownContent(sourceContentToTranslate, targetLang);
                    let translatedText = sourceContentToTranslate; // Default to untranslated on fail
                    if (translatedResult) {
                        if (translatedResult.usage) {
                            const inTokens = translatedResult.usage.inputTokens ?? 0;
                            const outTokens = translatedResult.usage.outputTokens ?? 0;
                            const totalTokens = translatedResult.usage.totalTokens ?? (inTokens + outTokens);
                            console.log(`[TRANSLATE] 📊 Tokens used: ${inTokens} prompt + ${outTokens} completion = ${totalTokens} total`);
                        }
                        translatedText = translatedResult.text;
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
            // Determine if it actually needs translation (NLP)
            let hasText = /[a-zA-Z0-9\u4e00-\u9fa5]/.test(rawContent);
            if (hasText) {
                const topLanguages = francAll(rawContent.substring(0, 2000)); // Sample first 2k
                let nlpSkipped = false;
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
                    console.log(`[COMPILER] 🌐 No i18n blocks found. Translating the entire content to '${targetLang}'...`);
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
    return toMarkdown(ast, { extensions: [frontmatterToMarkdown(['yaml'])] });
}
