import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { Root, Heading, Content, HTML, Link } from 'mdast';
import { visit } from 'unist-util-visit';

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
    'en': '🌍 English',
    'zh-CN': '🇨🇳 中文',
    'ja': '🇯🇵 日本語',
    'ko': '🇰🇷 한국어',
    'fr': '🇫🇷 Français',
    'es': '🇪🇸 Español',
    'de': '🇩🇪 Deutsch',
    'ru': '🇷🇺 Русский'
};

function getDisplayName(lang: string): string {
    return LANGUAGE_DISPLAY_NAMES[lang] || lang.toUpperCase();
}

/**
 * Merges multiple localized Markdown strings into a single consolidated AST
 * following the "Magic README Merger" pattern.
 */
export function mergeCompiledLangs(compiledMap: Map<string, string>): string {
    const processor = unified().use(remarkParse);

    // Parse all contents into ASTs
    const astMap = new Map<string, Root>();
    for (const [lang, content] of compiledMap.entries()) {
        astMap.set(lang, processor.parse(content) as Root);
    }

    const langs = Array.from(astMap.keys());
    if (langs.length === 0) return '';
    if (langs.length === 1) return compiledMap.get(langs[0])!;

    const mergedAst: Root = { type: 'root', children: [] };
    let globalH1: Heading | null = null;

    // 1. Extract the first H1 from the first language AST
    const firstLangAst = astMap.get(langs[0])!;
    const h1Index = firstLangAst.children.findIndex((node: any) => node.type === 'heading' && node.depth === 1);
    if (h1Index !== -1) {
        globalH1 = firstLangAst.children[h1Index] as Heading;
    }

    // Append global H1 if found
    if (globalH1) {
        mergedAst.children.push(globalH1);
    }

    // 2. Generate TOC Navigation Bar
    const tocParagraph: Content = { type: 'paragraph', children: [] };
    for (let i = 0; i < langs.length; i++) {
        const lang = langs[i];
        const displayName = getDisplayName(lang);
        const anchorId = lang.toLowerCase().replace(/[^a-z0-9]/g, '-');

        tocParagraph.children.push({
            type: 'link',
            url: `#${anchorId}`,
            children: [{ type: 'text', value: displayName }]
        });

        if (i < langs.length - 1) {
            tocParagraph.children.push({ type: 'text', value: ' | ' });
        }
    }

    // Append blank line equivalent (paragraph handles its spacing)
    mergedAst.children.push(tocParagraph);

    // Append `---`
    mergedAst.children.push({ type: 'thematicBreak' });

    // 3. Process each language
    for (let i = 0; i < langs.length; i++) {
        const lang = langs[i];
        const ast = astMap.get(lang)!;
        const displayName = getDisplayName(lang);
        const anchorId = lang.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Append explicit HTML anchor for universal compatibility
        mergedAst.children.push({
            type: 'html',
            value: `<a name="${anchorId}"></a>`
        } as unknown as HTML);

        // Append L2 Heading
        mergedAst.children.push({
            type: 'heading',
            depth: 2,
            children: [{ type: 'text', value: displayName }]
        });

        // Strip the first H1 from this individual AST
        const astH1Index = ast.children.findIndex((node: any) => node.type === 'heading' && node.depth === 1);
        let contentChildren = [...ast.children];
        if (astH1Index !== -1) {
            contentChildren.splice(astH1Index, 1);
        }

        // --- Anchor Scoping ---
        // 1. Rewrite HTML <a name="xyz"> or <a id="xyz"> to append `-${lang}`
        visit({ type: 'root', children: contentChildren } as unknown as Root, 'html', (node: HTML) => {
            node.value = node.value.replace(
                /<a([^>]*?)(name|id)\s*=\s*(['"])(.*?)\3([^>]*?)>/gi,
                (match, before, attr, quote, id, after) => {
                    return `<a${before}${attr}=${quote}${id}-${anchorId}${quote}${after}>`;
                }
            );
        });

        // 2. Rewrite internal Markdown links [foo](#xyz) to [foo](#xyz-${lang})
        visit({ type: 'root', children: contentChildren } as unknown as Root, 'link', (node: Link) => {
            if (node.url && node.url.startsWith('#')) {
                // Check if it's already an existing language jump anchor (we don't want to scope those)
                const targetAnchor = node.url.substring(1);
                const isLangNav = langs.some(l => l.toLowerCase().replace(/[^a-z0-9]/g, '-') === targetAnchor);

                if (!isLangNav && !targetAnchor.endsWith(`-${anchorId}`)) {
                    node.url = `${node.url}-${anchorId}`;
                }
            }
        });
        // ----------------------

        // Append the rest of the AST
        mergedAst.children.push(...contentChildren);

        // Append `---` delimiter if not the last language
        if (i < langs.length - 1) {
            mergedAst.children.push({ type: 'thematicBreak' });
        }
    }

    // Serialize back to markdown string
    return toMarkdown(mergedAst);
}
