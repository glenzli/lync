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
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.loadLockfile = loadLockfile;
exports.saveLockfile = saveLockfile;
exports.loadBuildConfig = loadBuildConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("yaml"));
const types_1 = require("./types");
const LyncYAML = 'lync.yaml';
const LyncLockYAML = 'lync-lock.yaml';
const LyncBuildYAML = 'lync-build.yaml';
function loadConfig(cwd = process.cwd()) {
    const configPath = path.join(cwd, LyncYAML);
    if (!fs.existsSync(configPath)) {
        return { dependencies: {} };
    }
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.parse(content) || { dependencies: {} };
}
function saveConfig(config, cwd = process.cwd()) {
    const configPath = path.join(cwd, LyncYAML);
    const content = yaml.stringify(config);
    fs.writeFileSync(configPath, content, 'utf8');
}
function loadLockfile(cwd = process.cwd()) {
    const lockPath = path.join(cwd, LyncLockYAML);
    if (!fs.existsSync(lockPath)) {
        return { version: 1, dependencies: {} };
    }
    const content = fs.readFileSync(lockPath, 'utf8');
    return yaml.parse(content) || { version: 1, dependencies: {} };
}
function saveLockfile(lock, cwd = process.cwd()) {
    const lockPath = path.join(cwd, LyncLockYAML);
    const content = yaml.stringify(lock);
    fs.writeFileSync(lockPath, content, 'utf8');
}
function loadBuildConfig(cwd = process.cwd()) {
    const buildPath = path.join(cwd, LyncBuildYAML);
    if (!fs.existsSync(buildPath)) {
        return { includes: [], outDir: './dist', routing: [] };
    }
    const content = fs.readFileSync(buildPath, 'utf8');
    return yaml.parse(content) || { includes: [], outDir: './dist', routing: [] };
}
//# sourceMappingURL=config.js.map