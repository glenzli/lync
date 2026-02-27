import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, loadLockfile, saveLockfile } from './config';
import { fetchMarkdown, computeHash } from './network';
import matter from 'gray-matter';

export async function syncDependencies(cwd: string = process.cwd()): Promise<void> {
    const config = loadConfig(cwd);
    const lock = loadLockfile(cwd);
    let lockModified = false;

    if (!config.dependencies || Object.keys(config.dependencies).length === 0) {
        console.log('No dependencies found in lync.yaml');
        return;
    }

    for (const [alias, declaration] of Object.entries(config.dependencies)) {
        const url = typeof declaration === 'string' ? declaration : declaration.url;
        const dest = typeof declaration === 'string' ? undefined : declaration.dest;

        if (!url) {
            console.warn(`[WARN] Alias '${alias}' has no URL specified. Skipping.`);
            continue;
        }

        const lockedDep = lock.dependencies[alias];
        const targetPath = dest ? path.resolve(cwd, dest) : path.join(cwd, '.lync', alias + '.md');
        let needsFetch = false;

        if (!lockedDep) {
            needsFetch = true;
        } else if (lockedDep.url !== url) {
            needsFetch = true;
        } else if (!fs.existsSync(targetPath)) {
            needsFetch = true;
        } else {
            // Content validation against lockfile hash
            const currentContent = fs.readFileSync(targetPath, 'utf8');
            const currentHash = computeHash(currentContent);
            if (currentHash !== lockedDep.hash) {
                needsFetch = true;
                console.warn(`[WARN] Hash mismatch for '${alias}'. File may have been locally modified. Re-fetching.`);
            }
        }

        if (needsFetch) {
            console.log(`[SYNC] Fetching '${alias}' from ${url}...`);
            try {
                const content = await fetchMarkdown(url);
                const hash = computeHash(content);

                // Ensure directory exists
                const dir = path.dirname(targetPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(targetPath, content, 'utf8');

                // Parse frontmatter
                const parsed = matter(content);
                const version = parsed.data.version;
                if (version) {
                    console.log(`[SYNC]   Found version: ${version}`);
                }

                if (parsed.data.lync && parsed.data.lync.dependencies) {
                    console.log(`[SYNC]   Found nested dependencies. Flat resolving...`);
                    // We dynamically add these to the current config so they sync in the same pass.
                    // If alias already exists, Root Override principle applies (we don't overwrite).
                    for (const [subAlias, subUrl] of Object.entries(parsed.data.lync.dependencies)) {
                        if (!config.dependencies[subAlias]) {
                            console.log(`[SYNC]   -> Inheriting '${subAlias}': ${subUrl}`);
                            config.dependencies[subAlias] = subUrl as string;
                        } else {
                            console.log(`[SYNC]   -> Skipping '${subAlias}' (Overridden by Root)`);
                        }
                    }
                }

                lock.dependencies[alias] = {
                    url,
                    dest,
                    version,
                    hash,
                    fetchedAt: new Date().toISOString()
                };
                lockModified = true;
                console.log(`[SYNC] ✅ '${alias}' updated successfully.`);
            } catch (err: any) {
                console.error(`[ERROR] Failed to sync '${alias}': ${err.message}`);
            }
        } else {
            console.log(`[SYNC] ⚡ '${alias}' is up to date.`);
        }
    }

    if (lockModified) {
        saveLockfile(lock, cwd);
        console.log(`[SYNC] lync-lock.yaml updated.`);
    }
}
