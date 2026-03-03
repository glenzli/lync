import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { VasmConfig, VasmLock, VasmBuild, VasmRc } from './types';

const VasmYAML = 'vasmc.yaml';
const VasmLockYAML = 'vasmc-lock.yaml';
const VasmBuildYAML = 'vasmc-build.yaml';

export function loadConfig(cwd: string = process.cwd()): VasmConfig {
    const configPath = path.join(cwd, VasmYAML);
    if (!fs.existsSync(configPath)) {
        return { dependencies: {} };
    }
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.parse(content) as VasmConfig || { dependencies: {} };
}

export function saveConfig(config: VasmConfig, cwd: string = process.cwd()): void {
    const configPath = path.join(cwd, VasmYAML);
    const content = yaml.stringify(config);
    fs.writeFileSync(configPath, content, 'utf8');
}

export function loadLockfile(cwd: string = process.cwd()): VasmLock {
    const lockPath = path.join(cwd, VasmLockYAML);
    if (!fs.existsSync(lockPath)) {
        return { version: 1, dependencies: {} };
    }
    const content = fs.readFileSync(lockPath, 'utf8');
    return yaml.parse(content) as VasmLock || { version: 1, dependencies: {} };
}

export function saveLockfile(lock: VasmLock, cwd: string = process.cwd()): void {
    const lockPath = path.join(cwd, VasmLockYAML);
    const content = yaml.stringify(lock);
    fs.writeFileSync(lockPath, content, 'utf8');
}

export function loadBuildConfig(cwd: string = process.cwd()): VasmBuild {
    const buildPath = path.join(cwd, VasmBuildYAML);
    if (!fs.existsSync(buildPath)) {
        return { includes: [], baseDir: '.', routing: [] };
    }
    const content = fs.readFileSync(buildPath, 'utf8');
    return yaml.parse(content) as VasmBuild || { includes: [], baseDir: '.', routing: [] };
}

/**
 * Loads the cascaded .vasmrc file for independent configurations like LLM tokens.
 * Priority: ~ (Global) -> ./ (Local)
 */
export function loadVasmRc(): VasmRc {
    let rcConfig: VasmRc = {};

    // 1. Load global ~/.vasmrc
    const globalRcPath = path.resolve(os.homedir(), '.vasmrc');
    if (fs.existsSync(globalRcPath)) {
        try {
            const globalContent = fs.readFileSync(globalRcPath, 'utf8');
            const parsed = yaml.parse(globalContent);
            if (parsed) rcConfig = { ...parsed };
        } catch (e) {
            console.warn(`[WARN] Failed to parse global ~/.vasmrc: ${e}`);
        }
    }

    // 2. Overwrite with local ./.vasmrc
    const localRcPath = path.resolve(process.cwd(), '.vasmrc');
    if (fs.existsSync(localRcPath)) {
        try {
            const localContent = fs.readFileSync(localRcPath, 'utf8');
            const parsed = yaml.parse(localContent);
            if (parsed) {
                rcConfig = {
                    ...rcConfig,
                    ...parsed,
                    llm: { ...rcConfig.llm, ...parsed.llm }
                };
            }
        } catch (e) {
            console.warn(`[WARN] Failed to parse local ./.vasmrc: ${e}`);
        }
    }

    return rcConfig;
}
