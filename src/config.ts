import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { LyncConfig, LyncLock, LyncBuild } from './types';

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
        return { includes: [], outDir: './dist', routing: [] };
    }
    const content = fs.readFileSync(buildPath, 'utf8');
    return yaml.parse(content) as LyncBuild || { includes: [], outDir: './dist', routing: [] };
}
