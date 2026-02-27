import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { LyncConfig, LyncLock, LyncBuild, LyncLLMConfig } from './types';

const LyncYAML = 'lync.yaml';
const LyncLockYAML = 'lync-lock.yaml';
const LyncBuildYAML = 'lync-build.yaml';

export function loadConfig(cwd: string = process.cwd()): LyncConfig {
    const configPath = path.join(cwd, LyncYAML);
    if (!fs.existsSync(configPath)) {
        return { dependencies: {} };
    }
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.parse(content) as LyncConfig || { dependencies: {} };
}

export function saveConfig(config: LyncConfig, cwd: string = process.cwd()): void {
    const configPath = path.join(cwd, LyncYAML);
    const content = yaml.stringify(config);
    fs.writeFileSync(configPath, content, 'utf8');
}

export function loadLockfile(cwd: string = process.cwd()): LyncLock {
    const lockPath = path.join(cwd, LyncLockYAML);
    if (!fs.existsSync(lockPath)) {
        return { version: 1, dependencies: {} };
    }
    const content = fs.readFileSync(lockPath, 'utf8');
    return yaml.parse(content) as LyncLock || { version: 1, dependencies: {} };
}

export function saveLockfile(lock: LyncLock, cwd: string = process.cwd()): void {
    const lockPath = path.join(cwd, LyncLockYAML);
    const content = yaml.stringify(lock);
    fs.writeFileSync(lockPath, content, 'utf8');
}

export function loadBuildConfig(cwd: string = process.cwd()): LyncBuild {
    const buildPath = path.join(cwd, LyncBuildYAML);
    if (!fs.existsSync(buildPath)) {
        return { includes: [], outDir: './dist', baseDir: '.', targetLangs: [], routing: [] };
    }
    const content = fs.readFileSync(buildPath, 'utf8');
    return yaml.parse(content) as LyncBuild || { includes: [], outDir: './dist', baseDir: '.', targetLangs: [], routing: [] };
}

/**
 * Loads the cascaded .lyncrc file for independent configurations like LLM tokens.
 * Priority: ~ (Global) -> ./ (Local)
 */
export function loadLyncRc(): { llm?: LyncLLMConfig } {
    let rcConfig: { llm?: LyncLLMConfig } = {};

    // 1. Load global ~/.lyncrc
    const globalRcPath = path.resolve(os.homedir(), '.lyncrc');
    if (fs.existsSync(globalRcPath)) {
        try {
            const globalContent = fs.readFileSync(globalRcPath, 'utf8');
            const parsed = yaml.parse(globalContent);
            if (parsed) rcConfig = { ...parsed };
        } catch (e) {
            console.warn(`[WARN] Failed to parse global ~/.lyncrc: ${e}`);
        }
    }

    // 2. Overwrite with local ./.lyncrc
    const localRcPath = path.resolve(process.cwd(), '.lyncrc');
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
            console.warn(`[WARN] Failed to parse local ./.lyncrc: ${e}`);
        }
    }

    return rcConfig;
}
