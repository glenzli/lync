import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, loadLockfile, saveLockfile } from './config';
import { computeHash, hashMatches, normalizeHash } from './network';
import { t } from './i18n';
import { parseFrontmatter } from './frontmatter';
import {
    normalizeDependencyDeclaration,
    readReference,
    resolveCatalogDependency,
    resolveDependencyTargetPath,
} from './dependencies';

export async function syncDependencies(cwd: string = process.cwd()): Promise<void> {
    const config = loadConfig(cwd);
    const lock = loadLockfile(cwd);
    lock.dependencies = lock.dependencies || {};
    let lockModified = false;

    if (!config.dependencies || Object.keys(config.dependencies).length === 0) {
        console.log('No dependencies found in vasmc.yaml');
        return;
    }

    for (const [alias, declaration] of Object.entries(config.dependencies)) {
        const dependency = normalizeDependencyDeclaration(alias, declaration);
        const dest = dependency.dest;
        let url = dependency.url;
        let catalogExport: Awaited<ReturnType<typeof resolveCatalogDependency>> | undefined;
        const lockedDep = lock.dependencies[alias];
        const targetPath = resolveDependencyTargetPath(cwd, alias, dependency);

        if (
            dependency.kind === 'catalog' &&
            lockedDep?.source === 'catalog' &&
            lockedDep.catalog === dependency.catalog &&
            lockedDep.export === dependency.exportName &&
            (lockedDep.dest || undefined) === (dest || undefined) &&
            fs.existsSync(targetPath) &&
            hashMatches(fs.readFileSync(targetPath, 'utf8'), lockedDep.hash)
        ) {
            console.log(t('SYNC_UP_TO_DATE_ALIAS', alias));
            continue;
        }

        try {
            if (dependency.kind === 'catalog') {
                catalogExport = await resolveCatalogDependency(dependency, cwd);
                url = catalogExport.artifactUrl;
            }
        } catch (err: any) {
            console.error(t('SYNC_ERR_FAILED', alias, err.message));
            continue;
        }

        if (!url) {
            console.warn(t('SYNC_WARN_NO_URL', alias));
            continue;
        }

        let needsFetch = false;

        if (!lockedDep) {
            needsFetch = true;
        } else if (lockedDep.url !== url) {
            needsFetch = true;
        } else if ((lockedDep.dest || undefined) !== (dest || undefined)) {
            needsFetch = true;
        } else if (dependency.kind === 'catalog' && (
            lockedDep.catalog !== dependency.catalog ||
            lockedDep.export !== dependency.exportName ||
            normalizeHash(lockedDep.hash) !== normalizeHash(catalogExport?.hash)
        )) {
            needsFetch = true;
        } else if (!fs.existsSync(targetPath)) {
            needsFetch = true;
        } else {
            // Content validation against lockfile hash
            const currentContent = fs.readFileSync(targetPath, 'utf8');
            if (!hashMatches(currentContent, lockedDep.hash)) {
                needsFetch = true;
                console.warn(t('SYNC_WARN_HASH_MISMATCH', alias));
            }
        }

        if (needsFetch) {
            console.log(t('SYNC_FETCHING_START', alias, url));
            try {
                const content = await readReference(url, cwd);
                const hash = computeHash(content);
                if (catalogExport && hash !== normalizeHash(catalogExport.hash)) {
                    throw new Error(`Catalog export '${catalogExport.exportName}' hash mismatch.`);
                }

                // Ensure directory exists
                const dir = path.dirname(targetPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(targetPath, content, 'utf8');

                // Parse frontmatter
                const parsed = parseFrontmatter(content);
                const version = catalogExport?.version || parsed.data.vasm?.version || parsed.data.version;
                if (version) {
                    console.log(t('SYNC_FOUND_VERSION', version));
                }

                if (!catalogExport && parsed.data.vasm && parsed.data.vasm.dependencies) {
                    console.log(t('SYNC_FOUND_NESTED'));
                    // We dynamically add these to the current config so they sync in the same pass.
                    // If alias already exists, Root Override principle applies (we don't overwrite).
                    for (const [subAlias, subDeclaration] of Object.entries(parsed.data.vasm.dependencies)) {
                        if (!config.dependencies[subAlias]) {
                            const displayDeclaration = typeof subDeclaration === 'string'
                                ? subDeclaration
                                : JSON.stringify(subDeclaration);
                            console.log(t('SYNC_INHERITING', subAlias, displayDeclaration));
                            config.dependencies[subAlias] = subDeclaration as any;
                        } else {
                            console.log(t('SYNC_SKIPPING_OVERRIDDEN', subAlias));
                        }
                    }
                }

                lock.dependencies[alias] = catalogExport
                    ? {
                        url,
                        dest,
                        source: 'catalog',
                        catalog: dependency.catalog,
                        export: catalogExport.exportName,
                        name: catalogExport.name,
                        version: catalogExport.version,
                        format: catalogExport.format,
                        hash: catalogExport.hash,
                        fetchedAt: new Date().toISOString()
                    }
                    : {
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
