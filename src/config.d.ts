import { LyncConfig, LyncLock, LyncBuild } from './types';
export declare function loadConfig(cwd?: string): LyncConfig;
export declare function saveConfig(config: LyncConfig, cwd?: string): void;
export declare function loadLockfile(cwd?: string): LyncLock;
export declare function saveLockfile(lock: LyncLock, cwd?: string): void;
export declare function loadBuildConfig(cwd?: string): LyncBuild;
//# sourceMappingURL=config.d.ts.map