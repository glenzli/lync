import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, loadLockfile, saveLockfile } from './config';
import { fetchMarkdown, computeHash } from './network';
import matter from 'gray-matter';
import { t } from './i18n';

export async function syncDependencies(cwd: string = process.cwd()): Promise<void> {
    const config = loadConfig(cwd);
    const lock = loadLockfile(cwd);
    let lockModified = false;

    if (!config.dependencies || Object.keys(config.dependencies).length === 0) {
        console.log('No dependencies found in vasmc.yaml');
        return;
    }

    for (const [alias, declaration] of Object.entries(config.dependencies)) {
        const url = typeof declaration === 'string' ? declaration : declaration.url;
        const dest = typeof declaration === 'string' ? undefined : declaration.dest;

        if (!url) {
            console.warn(t('SYNC_WARN_NO_URL', alias));
            continue;
        }

        const lockedDep = lock.dependencies[alias];
        const targetPath = dest ? path.resolve(cwd, dest) : path.join(cwd, '.vasmc', alias + '.md');
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
                console.warn(t('SYNC_WARN_HASH_MISMATCH', alias));
            }
        }

        if (needsFetch) {
            console.log(t('SYNC_FETCHING_START', alias, url));
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
                    console.log(t('SYNC_FOUND_VERSION', version));
                }

                if (parsed.data.vasm && parsed.data.vasm.dependencies) {
                    console.log(t('SYNC_FOUND_NESTED'));
                    // We dynamically add these to the current config so they sync in the same pass.
                    // If alias already exists, Root Override principle applies (we don't overwrite).
                    for (const [subAlias, subUrl] of Object.entries(parsed.data.vasm.dependencies)) {
                        if (!config.dependencies[subAlias]) {
                            console.log(t('SYNC_INHERITING', subAlias, subUrl as string));
                            config.dependencies[subAlias] = subUrl as string;
                        } else {
                            console.log(t('SYNC_SKIPPING_OVERRIDDEN', subAlias));
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
                console.log(t('SYNC_SUCCESS_ALIAS', alias));
            } catch (err: any) {
                console.error(t('SYNC_ERR_FAILED', alias, err.message));
            }
        } else {
            console.log(t('SYNC_UP_TO_DATE_ALIAS', alias));
        }
    }

    if (lockModified) {
        saveLockfile(lock, cwd);
        console.log(t('SYNC_LOCK_UPDATED'));
    }
}
