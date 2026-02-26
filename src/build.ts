import { glob } from 'glob';
import { minimatch } from 'minimatch';
import * as path from 'path';
import * as fs from 'fs';
import { loadBuildConfig } from './config';
import { compileFile } from './compiler';

export async function runWorkspaceBuild(cwd: string = process.cwd()) {
    const buildConfig = loadBuildConfig(cwd);

    const includes = buildConfig.includes && buildConfig.includes.length > 0
        ? buildConfig.includes
        : ['**/*.src.md'];

    const defaultOutDir = path.resolve(cwd, buildConfig.outDir || './dist');

    // Find all entry files
    const files = await glob(includes, {
        cwd: cwd,
        ignore: ['node_modules/**', '.lync/**', 'dist/**']
    });

    if (files.length === 0) {
        console.log(`[BUILD] No source files found matching patterns: ${includes.join(', ')}`);
        return;
    }

    for (const relativeFile of files) {
        const absoluteFile = path.resolve(cwd, relativeFile);
        let finalDest = path.resolve(defaultOutDir, relativeFile.replace(/\.src\.md$/, '.md'));

        // Apply routing interceptors
        if (buildConfig.routing && buildConfig.routing.length > 0) {
            for (const rule of buildConfig.routing) {
                if (minimatch(relativeFile, rule.match, { matchBase: true })) {
                    // Rule matched. Let's decide how to construct the dest.
                    const destBase = path.resolve(cwd, rule.dest);
                    if (!path.extname(destBase)) {
                        // It's a directory
                        const basename = path.basename(relativeFile).replace(/\.src\.md$/, '.md');
                        finalDest = path.join(destBase, basename);
                    } else {
                        // It's an exact file
                        finalDest = destBase;
                    }
                    break; // Stop at first routing match
                }
            }
        }

        console.log(`[BUILD] Compiling ${relativeFile} -> ${path.relative(cwd, finalDest)}`);

        try {
            // Ensure output directory exists
            const dir = path.dirname(finalDest);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Compile the AST and write
            const compiledContent = await compileFile(absoluteFile, finalDest);
            fs.writeFileSync(finalDest, compiledContent, 'utf8');
            console.log(`[BUILD] ✅ Success: ${path.relative(cwd, finalDest)}`);
        } catch (e: any) {
            console.error(`[BUILD] ❌ Failed to compile ${relativeFile}: ${e.message}`);
        }
    }
}
