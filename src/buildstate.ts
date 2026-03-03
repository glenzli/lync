import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';

const BUILD_STATE_FILE = 'vasmc-build-state.yaml';

// ========== Types ==========

export interface BuildStateEntry {
    inputSignature: string;  // SHA-256 of all transitive source file contents
    outputFile: string;      // relative path to expected output file
    targetLang: string;
}

export interface BuildState {
    version: 1;
    entries: Record<string, BuildStateEntry>;  // key: "relativeFile|lang"
}

// ========== Load / Save ==========

export function loadBuildState(cwd: string = process.cwd()): BuildState {
    const statePath = path.join(cwd, BUILD_STATE_FILE);
    if (!fs.existsSync(statePath)) {
        return { version: 1, entries: {} };
    }
    try {
        const content = fs.readFileSync(statePath, 'utf8');
        return yaml.parse(content) as BuildState || { version: 1, entries: {} };
    } catch {
        return { version: 1, entries: {} };
    }
}

export function saveBuildState(state: BuildState, cwd: string = process.cwd()): void {
    const statePath = path.join(cwd, BUILD_STATE_FILE);
    fs.writeFileSync(statePath, yaml.stringify(state), 'utf8');
}

// ========== Signature Computation ==========

/**
 * Computes a deterministic SHA-256 input signature for a build entry.
 * The signature covers the content of the entry file and all its transitive dependencies.
 * Sorted by absolute path for determinism.
 */
export function computeInputSignature(depPaths: Set<string>): string {
    const sorted = Array.from(depPaths).sort();
    const hash = crypto.createHash('sha256');
    for (const filePath of sorted) {
        if (fs.existsSync(filePath)) {
            hash.update(filePath);
            hash.update(fs.readFileSync(filePath));
        }
    }
    return hash.digest('hex');
}

// ========== Cache Key ==========

export function buildStateKey(relativeFile: string, targetLang: string): string {
    return `${relativeFile}|${targetLang || 'auto'}`;
}
