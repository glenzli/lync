import * as fs from 'fs';
import * as path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';
import { Root, Link } from 'mdast';
import { loadLockfile } from './config';
import { t } from './i18n';

interface GraphNode {
    name: string;
    filePath: string;
    type: 'inline' | 'link' | 'root';
    children: GraphNode[];
}

export async function generateGraph(entryFile: string, cwd: string = process.cwd()): Promise<void> {
    const lock = loadLockfile(cwd);
    const entryPath = path.resolve(cwd, entryFile);

    if (!fs.existsSync(entryPath)) {
        console.error(t('BUILD_ERR_ENTRY_NOT_FOUND', entryFile));
        return;
    }

    const visited = new Set<string>();

    async function buildTree(filePath: string, name: string, type: 'inline' | 'link' | 'root'): Promise<GraphNode> {
        const node: GraphNode = {
            name,
            filePath: path.relative(cwd, filePath),
            type,
            children: []
        };

        if (visited.has(filePath)) {
            // Circular dependency detected, stop recursion
            node.name += ' (circular)';
            return node;
        }

        visited.add(filePath);

        const content = fs.readFileSync(filePath, 'utf8');
        const processor = unified()
            .use(remarkParse)
            .use(remarkFrontmatter, ['yaml']);

        const ast = processor.parse(content) as Root;
        const imports: { url: string; title: string | null }[] = [];

        visit(ast, 'link', (linkNode: Link) => {
            if (linkNode.title && (linkNode.title.includes('@import:inline') || linkNode.title.includes('@import:link'))) {
                imports.push({
                    url: linkNode.url,
                    title: linkNode.title
                });
            }
        });

        for (const item of imports) {
            let nextFilePath: string;
            let nextName: string;

            if (item.url.startsWith('lync:')) {
                const alias = item.url.replace('lync:', '');
                nextName = alias;
                const lockedDep = lock.dependencies[alias];

                if (!lockedDep) {
                    node.children.push({
                        name: `${alias} (UNRESOLVED ALIAS)`,
                        filePath: 'missing',
                        type: item.title?.includes('inline') ? 'inline' : 'link',
                        children: []
                    });
                    continue;
                }

                nextFilePath = lockedDep.dest
                    ? path.resolve(cwd, lockedDep.dest)
                    : path.resolve(cwd, '.lync', alias + '.md');
            } else {
                nextName = item.url;
                nextFilePath = path.resolve(path.dirname(filePath), item.url);
            }

            const importType = item.title?.includes('inline') ? 'inline' : 'link';

            if (!fs.existsSync(nextFilePath)) {
                node.children.push({
                    name: `${nextName} (MISSING FILE)`,
                    filePath: path.relative(cwd, nextFilePath),
                    type: importType,
                    children: []
                });
            } else {
                const childNode = await buildTree(nextFilePath, nextName, importType);
                node.children.push(childNode);
            }
        }

        visited.delete(filePath); // Allow other branches to visit it, just avoid strict loops in current branch
        return node;
    }

    const rootNode = await buildTree(entryPath, path.basename(entryPath), 'root');

    console.log(`\\n📦 Lync Dependency Graph:\\n`);
    printTree(rootNode, '', true);
    console.log();
}

function printTree(node: GraphNode, prefix: string, isLast: boolean) {
    const isRoot = node.type === 'root';
    const typeIndicator = isRoot ? '' : `[${node.type}] `;

    if (isRoot) {
        console.log(`${node.name} (${node.filePath})`);
    } else {
        const branchString = isLast ? '└── ' : '├── ';
        console.log(`${prefix}${branchString}${typeIndicator}${node.name} -> ${node.filePath}`);
    }

    const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
    for (let i = 0; i < node.children.length; i++) {
        printTree(node.children[i], childPrefix, i === node.children.length - 1);
    }
}
