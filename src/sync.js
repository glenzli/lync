"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDependencies = syncDependencies;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const network_1 = require("./network");
async function syncDependencies(cwd = process.cwd()) {
    const config = (0, config_1.loadConfig)(cwd);
    const lock = (0, config_1.loadLockfile)(cwd);
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
        }
        else if (lockedDep.url !== url) {
            needsFetch = true;
        }
        else if (!fs.existsSync(targetPath)) {
            needsFetch = true;
        }
        else {
            // Content validation against lockfile hash
            const currentContent = fs.readFileSync(targetPath, 'utf8');
            const currentHash = (0, network_1.computeHash)(currentContent);
            if (currentHash !== lockedDep.hash) {
                needsFetch = true;
                console.warn(`[WARN] Hash mismatch for '${alias}'. File may have been locally modified. Re-fetching.`);
            }
        }
        if (needsFetch) {
            console.log(`[SYNC] Fetching '${alias}' from ${url}...`);
            try {
                const content = await (0, network_1.fetchMarkdown)(url);
                const hash = (0, network_1.computeHash)(content);
                // Ensure directory exists
                const dir = path.dirname(targetPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(targetPath, content, 'utf8');
                lock.dependencies[alias] = {
                    url,
                    dest,
                    hash,
                    fetchedAt: new Date().toISOString()
                };
                lockModified = true;
                console.log(`[SYNC] ✅ '${alias}' updated successfully.`);
            }
            catch (err) {
                console.error(`[ERROR] Failed to sync '${alias}': ${err.message}`);
            }
        }
        else {
            console.log(`[SYNC] ⚡ '${alias}' is up to date.`);
        }
    }
    if (lockModified) {
        (0, config_1.saveLockfile)(lock, cwd);
        console.log(`[SYNC] lync-lock.yaml updated.`);
    }
}
//# sourceMappingURL=sync.js.map