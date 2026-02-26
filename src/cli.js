"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCLI = setupCLI;
const commander_1 = require("commander");
const sync_1 = require("./sync");
const config_1 = require("./config");
function setupCLI() {
    const program = new commander_1.Command();
    program
        .name('lync')
        .description('A decentralized markdown package manager and compiler.')
        .version('0.1.0');
    program
        .command('add <url>')
        .description('Add a remote dependency')
        .option('--alias <alias>', 'Explicitly set the alias name')
        .option('--dest <dest>', 'Explicitly set local destination path')
        .action(async (url, options) => {
        const config = (0, config_1.loadConfig)();
        config.dependencies = config.dependencies || {};
        let alias = options.alias;
        // 1. Filename Inference
        if (!alias) {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const basename = pathname.split('/').pop() || 'unnamed-dep';
                alias = basename.replace(/\.[^/.]+$/, ""); // strip extension
            }
            catch (e) {
                alias = 'unnamed-dep';
            }
        }
        // 2. Collision Resolution
        let finalAlias = alias;
        let counter = 1;
        while (config.dependencies[finalAlias]) {
            // Checking if URL already matches exactly, safe to override
            const existingDecl = config.dependencies[finalAlias];
            const existingUrl = typeof existingDecl === 'string' ? existingDecl : existingDecl.url;
            if (existingUrl === url) {
                break;
            }
            finalAlias = `${alias}-${counter}`;
            counter++;
        }
        // Add to config
        if (options.dest) {
            config.dependencies[finalAlias] = { url, dest: options.dest };
        }
        else {
            config.dependencies[finalAlias] = url; // simplified string declaration
        }
        (0, config_1.saveConfig)(config);
        console.log(`[CLI] Added alias '${finalAlias}' pointing to ${url}`);
        // Auto-sync afterwards
        await (0, sync_1.syncDependencies)();
    });
    program
        .command('sync')
        .alias('install')
        .description('Sync all dependencies from lync.yaml')
        .action(async () => {
        await (0, sync_1.syncDependencies)();
    });
    program
        .command('update [alias]')
        .description('Force update dependencies, ignoring lockfile cache')
        .action(async (alias) => {
        const lock = (0, config_1.loadLockfile)();
        if (alias) {
            if (lock.dependencies[alias]) {
                delete lock.dependencies[alias];
                console.log(`[CLI] Cleared lock cache for '${alias}'.`);
            }
            else {
                console.warn(`[WARN] Alias '${alias}' not found in lockfile.`);
            }
        }
        else {
            lock.dependencies = {};
            console.log(`[CLI] Cleared locked cache for all dependencies.`);
        }
        (0, config_1.saveLockfile)(lock);
        await (0, sync_1.syncDependencies)();
    });
    return program;
}
//# sourceMappingURL=cli.js.map