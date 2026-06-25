import { loadVasmRc } from './config';

type Dictionary = Record<string, string>;

const dictionaries: Record<string, Dictionary> = {
    'en': {
        // General
        'WARN_RC_PARSE': '[WARN] Failed to parse ~/.vasmrc: {0}',

        // Init
        'INIT_WARN_EXISTS': '[INIT] ⚠️ vasmc-build.yaml already exists in the current directory.',
        'INIT_SUCCESS': '[INIT] ✅ Successfully created vasmc-build.yaml!',

        // Add
        'ADD_FETCHING': '[CLI] Fetching {0} to inspect metadata...',
        'ADD_DISCOVERED_ALIAS': '[CLI] Discovered declared alias from Frontmatter: \'{0}\'',
        'ADD_GENERIC_PATH': '[CLI] Generic path detected. Traversed up to infer alias: \'{0}\'',
        'ADD_SUCCESS': '[CLI] Added alias \'{0}\' pointing to {1}',

        // Seal
        'SEAL_ERR_NO_FILES': '[ERROR] Please specify at least one file or pattern to seal.',
        'SEAL_ERR_NO_MATCH': '[ERROR] No files matched the given patterns.',
        'SEAL_WARN_EXISTS': '[WARN] File \'{0}\' already contains VASMC Frontmatter.',
        'SEAL_AUTO_WRAP': '[CLI] 🌐 Auto-wrapped content in \'{0}\' block.',
        'SEAL_SUCCESS_RENAME': '[CLI] 📦 Sealed module! Renamed to \'{0}\' and injected Frontmatter (alias: \'{1}\').',
        'SEAL_SUCCESS_INJECT': '[CLI] 📦 Sealed module! Injected Frontmatter into \'{0}\' (alias: \'{1}\').',
        'LANG_DETECT_UNCERTAIN': '[LANG] Could not confidently infer source language for \'{0}\'. Leaving targetLangs unset; pass --lang or edit frontmatter to declare it explicitly.',
        'LANG_DETECT_AGENT_FALLBACK': '[LANG] Could not confidently infer source language for \'{0}\'. Agent mode will use first target language as source: \'{1}\'.',

        // Sync & Update
        'UPDATE_CLEARED_ALIAS': '[CLI] Cleared lock cache for \'{0}\'.',
        'UPDATE_WARN_NOT_FOUND': '[WARN] Alias \'{0}\' not found in lockfile.',
        'UPDATE_CLEARED_ALL': '[CLI] Cleared locked cache for all dependencies.',

        // Build CLI
        'CLI_DESC_GRAPH': 'Generate an ASCII dependency graph for the specified entry file.',
        'BUILD_ERR_ENTRY_NOT_FOUND': '[ERROR] Entry file not found: {0}',
        'BUILD_SUCCESS_SINGLE': '[BUILD] ✅ Compiled {0} {1} -> {2}',
        'BUILD_ERR_SINGLE': '[BUILD] ❌ Failed to compile {0}: {1}',

        // Build Workspace
        'BUILD_NO_FILES': '[BUILD] No source files found matching patterns: {0}',
        'BUILD_COMPILING': '[BUILD] Compiling {0} {1} -> {2}',
        'BUILD_SUCCESS': '[BUILD] ✅ Success: {0}',
        'BUILD_WARN_EXTRACT': '[WARN] Skipping unknown language \'{0}\' in {1}',
        'BUILD_ERR_WORKSPACE': '[BUILD] ❌ Failed to compile {0} ({1}): {2}',
        'WARN_TOKEN_LIMIT': '\\n[WARN] ⚠️ The compiled output contains approximately {0} tokens, which exceeds the recommended 20,000 token limit for System Prompts. Consider refactoring or trimming your context window.',

        // Network / Sync
        'SYNC_WARN_NO_URL': '[SYNC] ⚠️ No URL defined for alias \'{0}\'. Skipping.',
        'SYNC_WARN_HASH_MISMATCH': '[SYNC] ⚠️ Local hash mismatch for \'{0}\'. Re-fetching.',
        'SYNC_FETCHING_START': '[SYNC] Fetching: {0} -> {1}',
        'SYNC_FOUND_VERSION': '  ↳ Found version: {0}',
        'SYNC_FOUND_NESTED': '  ↳ Found nested dependencies. Inheriting...',
        'SYNC_INHERITING': '  ↳ Inheriting dependency: {0} -> {1}',
        'SYNC_SKIPPING_OVERRIDDEN': '  ↳ Skipping \'{0}\' (overridden by root project).',
        'SYNC_SUCCESS_ALIAS': '  ↳ Synced: {0}',
        'SYNC_ERR_FAILED': '[SYNC] ❌ Failed to sync \'{0}\': {1}',
        'SYNC_UP_TO_DATE_ALIAS': '[SYNC] ✅ \'{0}\' is up-to-date.',
        'SYNC_LOCK_UPDATED': '[SYNC] 🔒 Lockfile updated.',

        // Compiler
        'COMPILER_USE_EXISTING_BLOCK': '[COMPILER] ⚡️ Using existing \'{0}\' block for {1}',
        'COMPILER_NLP_SKIP': '[COMPILER] ⚡️ Detected source already matches \'{0}\'. Keeping deterministic source text.',
        'COMPILER_ROUTER_SKIP': '[COMPILER] ⚡️ Routing-only module detected. Keeping deterministic source text for \'{0}\'.',
        'COMPILER_TRANS_UNAVAILABLE': '[COMPILER] Missing target language \'{0}\' in {1}. Deterministic compile will keep source text; use vasmc agent work orders or the console package for assisted translation.',
        'COMPILER_ERR_INFER_LANG': '[ERROR] Could not infer AST language from {0}. Please ensure it contains <!-- lang:xx --> blocks or specify --target-langs.',
        'COMPILER_SKIP_MATCHING': '[COMPILER] Skipped matching translation code for \'{0}\''
    },
    'zh-CN': {
        // General
        'WARN_RC_PARSE': '[WARN] 解析 ~/.vasmrc 失败: {0}',

        // Init
        'INIT_WARN_EXISTS': '[INIT] ⚠️ vasmc-build.yaml 已存在于当前目录中。',
        'INIT_SUCCESS': '[INIT] ✅ 成功创建 vasmc-build.yaml 配置文件！',

        // Add
        'ADD_FETCHING': '[CLI] 正在拉取 {0} 以检查元数据...',
        'ADD_DISCOVERED_ALIAS': '[CLI] 从 Frontmatter 中发现声明的别名: \'{0}\'',
        'ADD_GENERIC_PATH': '[CLI] 探测到通用路径。正向上回溯以推断别名: \'{0}\'',
        'ADD_SUCCESS': '[CLI] 已添加别名 \'{0}\' 指向 {1}',

        // Seal
        'SEAL_ERR_NO_FILES': '[ERROR] 请至少指定一个文件或模式进行密封 (seal)。',
        'SEAL_ERR_NO_MATCH': '[ERROR] 没有找到匹配该模式的文件。',
        'SEAL_WARN_EXISTS': '[WARN] 文件 \'{0}\' 已经包含 VASMC Frontmatter。',
        'SEAL_AUTO_WRAP': '[CLI] 🌐 已将内容自动用 \'{0}\' 语言块包裹。',
        'SEAL_SUCCESS_RENAME': '[CLI] 📦 模块密封完毕！已重命名为 \'{0}\' 并注入了 Frontmatter (别名: \'{1}\')。',
        'SEAL_SUCCESS_INJECT': '[CLI] 📦 模块密封完毕！已在 \'{0}\' 中注入 Frontmatter (别名: \'{1}\')。',
        'LANG_DETECT_UNCERTAIN': '[LANG] 无法高置信度推断 \'{0}\' 的源语言。已保留 targetLangs 未声明；请通过 --lang 或 frontmatter 显式声明。',
        'LANG_DETECT_AGENT_FALLBACK': '[LANG] 无法高置信度推断 \'{0}\' 的源语言。Agent 模式将使用第一个目标语言作为源语言: \'{1}\'。',

        // Sync & Update
        'UPDATE_CLEARED_ALIAS': '[CLI] 已清除 \'{0}\' 的 lock 缓存。',
        'UPDATE_WARN_NOT_FOUND': '[WARN] lockfile 中未找到别名 \'{0}\'。',
        'UPDATE_CLEARED_ALL': '[CLI] 已清除所有依赖的 lock 缓存。',

        // Build CLI
        'CLI_DESC_GRAPH': '为指定的入口文件生成依赖关系拓扑图。',
        'BUILD_ERR_ENTRY_NOT_FOUND': '[ERROR] 找不到入口文件: {0}',
        'BUILD_SUCCESS_SINGLE': '[BUILD] ✅ 编译成功 {0} {1} -> {2}',
        'BUILD_ERR_SINGLE': '[BUILD] ❌ 编译失败 {0}: {1}',

        // Build Workspace
        'BUILD_NO_FILES': '[BUILD] 未找到匹配该模式的源文件: {0}',
        'BUILD_COMPILING': '[BUILD] 正在编译 {0} {1} -> {2}',
        'BUILD_SUCCESS': '[BUILD] ✅ 编译成功: {0}',
        'BUILD_WARN_EXTRACT': '[WARN] 跳过 {1} 中的未知语言 \'{0}\'',
        'BUILD_ERR_WORKSPACE': '[BUILD] ❌ 编译失败 {0} ({1}): {2}',
        'WARN_TOKEN_LIMIT': '\\n[WARN] ⚠️ 编译后的产物大约包含 {0} 个 Token。这超过了 System Prompt 推荐的安全阈值 (20,000)，请合理管控以防大模型注意力丢失或触发截断。',

        // Network / Sync
        'SYNC_WARN_NO_URL': '[SYNC] ⚠️ 别名 \'{0}\' 未定义 URL，已跳过。',
        'SYNC_WARN_HASH_MISMATCH': '[SYNC] ⚠️ \'{0}\' 本地哈希不匹配，重新拉取。',
        'SYNC_FETCHING_START': '[SYNC] 正在拉取: {0} -> {1}',
        'SYNC_FOUND_VERSION': '  ↳ 发现版本号: {0}',
        'SYNC_FOUND_NESTED': '  ↳ 发现嵌套依赖，正在继承...',
        'SYNC_INHERITING': '  ↳ 继承依赖: {0} -> {1}',
        'SYNC_SKIPPING_OVERRIDDEN': '  ↳ 跳过 \'{0}\'（已被主项目覆写）。',
        'SYNC_SUCCESS_ALIAS': '  ↳ 同步完成: {0}',
        'SYNC_ERR_FAILED': '[SYNC] ❌ 同步 \'{0}\' 失败: {1}',
        'SYNC_UP_TO_DATE_ALIAS': '[SYNC] ✅ \'{0}\' 已是最新。',
        'SYNC_LOCK_UPDATED': '[SYNC] 🔒 锁文件已更新。',

        // Compiler
        'COMPILER_USE_EXISTING_BLOCK': '[COMPILER] ⚡️ 对于文件 {1}，已复用现有的 \'{0}\' 语言块',
        'COMPILER_NLP_SKIP': '[COMPILER] ⚡️ 检测到源文本已经匹配 \'{0}\'。确定性保留源文本。',
        'COMPILER_ROUTER_SKIP': '[COMPILER] ⚡️ 检测到纯路由聚合模块。针对 \'{0}\' 确定性保留源文本。',
        'COMPILER_TRANS_UNAVAILABLE': '[COMPILER] 文件 {1} 中缺少目标语言 \'{0}\'。确定性编译将保留源文本；请使用 vasmc agent 工作单或 console 包执行辅助翻译。',
        'COMPILER_ERR_INFER_LANG': '[ERROR] 无法从 {0} 推断 AST 语言。请确保文件中包含 <!-- lang:xx --> 代码块，或者通过 --target-langs 显式指定。',
        'COMPILER_SKIP_MATCHING': '[COMPILER] 跳过匹配翻译代码 \'{0}\''
    }
};

let currentLang = 'en';

export function getCurrentLang(): string {
    return currentLang;
}

export function initI18n(langOverride?: string) {
    if (langOverride && dictionaries[langOverride]) {
        currentLang = langOverride;
        return;
    }

    // Try reading global/local config
    const rc = loadVasmRc();
    if (rc.lang && dictionaries[rc.lang]) {
        currentLang = rc.lang;
        return;
    }

    // Try system fallback
    const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (systemLocale.startsWith('zh')) {
        currentLang = 'zh-CN';
    } else {
        currentLang = 'en'; // Default
    }
}

export function t(key: string, ...args: (string | number)[]): string {
    const dict = dictionaries[currentLang] || dictionaries['en'];
    let str = dict[key];

    if (!str) {
        str = dictionaries['en'][key] || key; // fallback to en, or key itself
    }

    for (let i = 0; i < args.length; i++) {
        str = str.replace(`{${i}}`, String(args[i]));
    }

    return str;
}
