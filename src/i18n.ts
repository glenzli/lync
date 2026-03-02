import { loadLyncRc } from './config';

type Dictionary = Record<string, string>;

const dictionaries: Record<string, Dictionary> = {
    'en': {
        // General
        'WARN_RC_PARSE': '[WARN] Failed to parse ~/.lyncrc: {0}',

        // Init
        'INIT_WARN_EXISTS': '[INIT] ⚠️ lync-build.yaml already exists in the current directory.',
        'INIT_SUCCESS': '[INIT] ✅ Successfully created lync-build.yaml!',

        // Add
        'ADD_FETCHING': '[CLI] Fetching {0} to inspect metadata...',
        'ADD_DISCOVERED_ALIAS': '[CLI] Discovered declared alias from Frontmatter: \'{0}\'',
        'ADD_GENERIC_PATH': '[CLI] Generic path detected. Traversed up to infer alias: \'{0}\'',
        'ADD_SUCCESS': '[CLI] Added alias \'{0}\' pointing to {1}',

        // Seal
        'SEAL_ERR_NO_FILES': '[ERROR] Please specify at least one file or pattern to seal.',
        'SEAL_ERR_NO_MATCH': '[ERROR] No files matched the given patterns.',
        'SEAL_WARN_EXISTS': '[WARN] File \'{0}\' already contains Lync Frontmatter.',
        'SEAL_AUTO_WRAP': '[CLI] 🌐 Auto-wrapped content in \'{0}\' block.',
        'SEAL_SUCCESS_RENAME': '[CLI] 📦 Sealed module! Renamed to \'{0}\' and injected Frontmatter (alias: \'{1}\').',
        'SEAL_SUCCESS_INJECT': '[CLI] 📦 Sealed module! Injected Frontmatter into \'{0}\' (alias: \'{1}\').',

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
        'BUILD_VERIFY_FAILED': '[BUILD] 🛑 Verification failed for {0} ({1}), aborting further builds.',
        'BUILD_WARN_EXTRACT': '[WARN] Skipping unknown language \'{0}\' in {1}',
        'BUILD_ERR_WORKSPACE': '[BUILD] ❌ Failed to compile {0} ({1}): {2}',
        'WARN_TOKEN_LIMIT': '\\n[WARN] ⚠️ The compiled output contains approximately {0} tokens, which exceeds the recommended 20,000 token limit for System Prompts. Consider refactoring or trimming your context window.',

        // Verify
        'verify.lang': 'en', // Explicit mapping for exactly what verifyLLMLang needs
        'LINT_INIT': '\\n[LINT] 🤖 Initiating LLM Semantic Analysis (Lang: {0})...',
        'LINT_ANALYZING': '[LINT] Analyzing composite logic ({0} characters)...\\n',
        'LINT_PASS': '[LINT] ✅ No semantic issues found. Result: PASS.',
        'LINT_WARN': '\\n[LINT] ⚠️ Minor issues or redundancies found. Result: WARN (Non-blocking).',
        'LINT_BLOCK': '\\n[LINT] 🛑 Critical system destruction risk detected! Result: BLOCK.',
        'LINT_UNKNOWN': '\\n[LINT] ❓ Unknown verification result format. Assuming BLOCK for safety.',
        'LINT_ERR_FAILED': '[LINT] ❌ Failed to run LLM verification: {0}',
        'LINT_ERR_CONTINUE': '\\n[LINT] ⚠️ Verify API failed, but --verify-continue-on-error is set. Continuing build...',
        'LINT_SELECT_BEST': '\\n[LINT] ⚖️ Selected best variant for verification: {0} ({1} tokens)',

        // Diff
        'DIFF_INIT': '\\n[DIFF] 🤖 Initiating LLM Semantic Diff Analysis (Lang: {0})...',
        'DIFF_ANALYZING': '[DIFF] Diffing contexts: {0} chars (old) vs {1} chars (new)...\\n',
        'DIFF_ERR_FAILED': '[DIFF] ❌ LLM Diff Analysis failed: {0}',
        'DIFF_NO_CHANGES': '[DIFF] ⚪ No structural or semantic changes detected by LLM.',
        'DIFF_RESULT_PREFIX': '[DIFF] 📝 Analysis Report:\\n{0}\\n',

        // Network / Sync
        'SYNC_START': '[SYNC] Fetching dependencies...',
        'SYNC_FETCHING': '[SYNC] Fetching: {0} -> {1}',
        'SYNC_DOWNLOADED': '  ↳ Downloaded: {0}',
        'SYNC_DEST_BUILT': '  ↳ Built explicit destination: {0}',
        'SYNC_ERR_FETCH': '[SYNC] Error fetching {0}: {1}',
        'SYNC_UP_TO_DATE': '[SYNC] Everything is up-to-date.',
        'SYNC_DONE': '[SYNC] Done.',

        // Compiler
        'COMPILER_USE_EXISTING_BLOCK': '[COMPILER] ⚡️ Using existing \'{0}\' block for {1}',
        'COMPILER_TRANS_START': '[COMPILER] 🌐 Target language \'{0}\' not found in blocks. Translating fallback block for {1}...',
        'COMPILER_TRANS_TOKENS': '[TRANSLATE] 📊 Tokens used: {0} prompt + {1} completion = {2} total',
        'COMPILER_NLP_SKIP': '[COMPILER] ⚡️ NLP detected source is already \'{0}\'. Skipping LLM translation.',
        'COMPILER_ROUTER_SKIP': '[COMPILER] ⚡️ Pure routing module detected. Skipping LLM translation to \'{0}\'.',
        'COMPILER_TRANS_FULL': '[COMPILER] 🌐 No language blocks found. Translating the entire content to \'{0}\'...',
        'COMPILER_ERR_INFER_LANG': '[ERROR] Could not infer AST language from {0}. Please ensure it contains :::lang blocks or specify --target-langs.',
        'COMPILER_SKIP_MATCHING': '[COMPILER] Skipped matching translation code for \'{0}\'',
        'COMPILER_ERR_MISSING_LLM': '[COMPILER] No suitable language block found in {0} and no OPENAI_API_KEY provided for auto-translation.',
        'COMPILER_TRANS_SUCCESS': '[COMPILER] ✅ Auto-translation to \'{0}\' successful.',
        'COMPILER_TRANS_ERR': '[COMPILER] ❌ LLM Auto-Translation failed: {0}'
    },
    'zh-CN': {
        // General
        'WARN_RC_PARSE': '[WARN] 解析 ~/.lyncrc 失败: {0}',

        // Init
        'INIT_WARN_EXISTS': '[INIT] ⚠️ lync-build.yaml 已存在于当前目录中。',
        'INIT_SUCCESS': '[INIT] ✅ 成功创建 lync-build.yaml 配置文件！',

        // Add
        'ADD_FETCHING': '[CLI] 正在拉取 {0} 以检查元数据...',
        'ADD_DISCOVERED_ALIAS': '[CLI] 从 Frontmatter 中发现声明的别名: \'{0}\'',
        'ADD_GENERIC_PATH': '[CLI] 探测到通用路径。正向上回溯以推断别名: \'{0}\'',
        'ADD_SUCCESS': '[CLI] 已添加别名 \'{0}\' 指向 {1}',

        // Seal
        'SEAL_ERR_NO_FILES': '[ERROR] 请至少指定一个文件或模式进行密封 (seal)。',
        'SEAL_ERR_NO_MATCH': '[ERROR] 没有找到匹配该模式的文件。',
        'SEAL_WARN_EXISTS': '[WARN] 文件 \'{0}\' 已经包含 Lync Frontmatter。',
        'SEAL_AUTO_WRAP': '[CLI] 🌐 已将内容自动用 \'{0}\' 语言块包裹。',
        'SEAL_SUCCESS_RENAME': '[CLI] 📦 模块密封完毕！已重命名为 \'{0}\' 并注入了 Frontmatter (别名: \'{1}\')。',
        'SEAL_SUCCESS_INJECT': '[CLI] 📦 模块密封完毕！已在 \'{0}\' 中注入 Frontmatter (别名: \'{1}\')。',

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
        'BUILD_VERIFY_FAILED': '[BUILD] 🛑 目标文件 {0} ({1}) 语义验证失败，中止后续构建。',
        'BUILD_WARN_EXTRACT': '[WARN] 跳过 {1} 中的未知语言 \'{0}\'',
        'BUILD_ERR_WORKSPACE': '[BUILD] ❌ 编译失败 {0} ({1}): {2}',
        'WARN_TOKEN_LIMIT': '\\n[WARN] ⚠️ 编译后的产物大约包含 {0} 个 Token。这超过了 System Prompt 推荐的安全阈值 (20,000)，请合理管控以防大模型注意力丢失或触发截断。',

        // Verify
        'verify.lang': 'zh-CN',
        'LINT_INIT': '\\n[LINT] 🤖 正在启动大模型原生语义检查 (语言: {0})...',
        'LINT_ANALYZING': '[LINT] 正在分析组合后的逻辑上下文 (共 {0} 个字符)...\\n',
        'LINT_PASS': '[LINT] ✅ 未发现严重的语义风险。结果: PASS(通过)。',
        'LINT_WARN': '\\n[LINT] ⚠️ 发现次要问题或逻辑冗余。结果: WARN (非阻断警告)。',
        'LINT_BLOCK': '\\n[LINT] 🛑 探测到严重的系统破坏风险！结果: BLOCK(阻断)。',
        'LINT_UNKNOWN': '\\n[LINT] ❓ 未知的验证结果格式。为安全起见假定为 BLOCK。',
        'LINT_ERR_FAILED': '[LINT] ❌ 大模型验证运行失败: {0}',
        'LINT_ERR_CONTINUE': '\\n[LINT] ⚠️ 验证API调用失败，但检测到 --verify-continue-on-error 标志，继续执行构建...',
        'LINT_SELECT_BEST': '\\n[LINT] ⚖️ 选择最佳变体验证: {0} ({1} tokens)',

        // Diff
        'DIFF_INIT': '\\n[DIFF] 🤖 正在启动大模型语义 Diff 分析 (语言: {0})...',
        'DIFF_ANALYZING': '[DIFF] 正在比对上下文区块: {0} 字符 (旧) vs {1} 字符 (新)...\\n',
        'DIFF_ERR_FAILED': '[DIFF] ❌ 大模型 Diff 分析失败: {0}',
        'DIFF_NO_CHANGES': '[DIFF] ⚪ 大模型未检测到结构性或重大的语义变化。',
        'DIFF_RESULT_PREFIX': '[DIFF] 📝 变更分析报告:\\n{0}\\n',

        // Network / Sync
        'SYNC_START': '[SYNC] 正在探测依赖状态...',
        'SYNC_FETCHING': '[SYNC] 正在拉取: {0} -> {1}',
        'SYNC_DOWNLOADED': '  ↳ 已下载源码: {0}',
        'SYNC_DEST_BUILT': '  ↳ 已构建指定的物理路径: {0}',
        'SYNC_ERR_FETCH': '[SYNC] 拉取 {0} 失败: {1}',
        'SYNC_UP_TO_DATE': '[SYNC] 所有依赖均已是最新状态。',
        'SYNC_DONE': '[SYNC] 同步完成。',

        // Compiler
        'COMPILER_USE_EXISTING_BLOCK': '[COMPILER] ⚡️ 对于文件 {1}，已复用现有的 \'{0}\' 语言块',
        'COMPILER_TRANS_START': '[COMPILER] 🌐 在源中未找到目标语言 \'{0}\' 的区块。正在为 {1} 动态翻译降级块...',
        'COMPILER_TRANS_TOKENS': '[TRANSLATE] 📊 Token 消耗: {0} 提示 + {1} 生成 = {2} 总计',
        'COMPILER_NLP_SKIP': '[COMPILER] ⚡️ NLP 探测到全量源码已是 \'{0}\' 语言。跳过大模型翻译。',
        'COMPILER_ROUTER_SKIP': '[COMPILER] ⚡️ 检测到纯路由聚合模块。跳过针对 \'{0}\' 的大模型盲翻。',
        'COMPILER_TRANS_FULL': '[COMPILER] 🌐 未找到局部语种编译块。正在对全量内容进行 \'{0}\' 翻译...',
        'COMPILER_ERR_INFER_LANG': '[ERROR] 无法从 {0} 推断 AST 语言。请确保文件中包含 :::lang 代码块，或者通过 --target-langs 显式指定。',
        'COMPILER_SKIP_MATCHING': '[COMPILER] 跳过匹配翻译代码 \'{0}\'',
        'COMPILER_ERR_MISSING_LLM': '[COMPILER] 在 {0} 中未找到对应的语言块，且未配置 OPENAI_API_KEY 无法回退到自动翻译。',
        'COMPILER_TRANS_SUCCESS': '[COMPILER] ✅ 动态翻译至 \'{0}\' 成功。',
        'COMPILER_TRANS_ERR': '[COMPILER] ❌ 大模型动态翻译回退失败: {0}'
    }
};

let currentLang = 'en';

export function getVerifyLang(): string {
    return t('verify.lang');
}

export function initI18n(langOverride?: string) {
    if (langOverride && dictionaries[langOverride]) {
        currentLang = langOverride;
        return;
    }

    // Try reading global/local config
    const rc = loadLyncRc();
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
