import { getCurrentLang } from '../../core/src/i18n';

type Dictionary = Record<string, string>;

const dictionaries: Record<string, Dictionary> = {
    en: {
        'verify.lang': 'en',
        'LINT_INIT': '\\n[LINT] 🤖 Initiating LLM Semantic Analysis (Lang: {0})...',
        'LINT_ANALYZING': '[LINT] Analyzing composite logic ({0} characters)...\\n',
        'LINT_PASS': '[LINT] ✅ No semantic issues found. Result: PASS.',
        'LINT_WARN': '\\n[LINT] ⚠️ Minor issues or redundancies found. Result: WARN (Non-blocking).',
        'LINT_BLOCK': '\\n[LINT] 🛑 Critical system destruction risk detected! Result: BLOCK.',
        'LINT_UNKNOWN': '\\n[LINT] ❓ Unknown verification result format. Assuming BLOCK for safety.',
        'LINT_ERR_FAILED': '[LINT] ❌ Failed to run LLM verification: {0}',
        'LINT_ERR_CONTINUE': '\\n[LINT] ⚠️ Verify API failed, but --continue-on-error is set. Continuing...',
        'DIFF_INIT': '\\n[DIFF] 🤖 Initiating LLM Semantic Diff Analysis (Lang: {0})...',
        'DIFF_ANALYZING': '[DIFF] Diffing contexts: {0} tokens (old) vs {1} tokens (new)...\\n',
        'DIFF_ERR_FAILED': '[DIFF] ❌ LLM Diff Analysis failed: {0}',
        'DIFF_NO_CHANGES': '[DIFF] ⚪ No structural or semantic changes detected by LLM.',
        'DIFF_RESULT_PREFIX': '[DIFF] 📝 Analysis Report:\\n{0}\\n',
    },
    'zh-CN': {
        'verify.lang': 'zh-CN',
        'LINT_INIT': '\\n[LINT] 🤖 正在启动大模型原生语义检查 (语言: {0})...',
        'LINT_ANALYZING': '[LINT] 正在分析组合后的逻辑上下文 (共 {0} 个字符)...\\n',
        'LINT_PASS': '[LINT] ✅ 未发现严重的语义风险。结果: PASS(通过)。',
        'LINT_WARN': '\\n[LINT] ⚠️ 发现次要问题或逻辑冗余。结果: WARN (非阻断警告)。',
        'LINT_BLOCK': '\\n[LINT] 🛑 探测到严重的系统破坏风险！结果: BLOCK(阻断)。',
        'LINT_UNKNOWN': '\\n[LINT] ❓ 未知的验证结果格式。为安全起见假定为 BLOCK。',
        'LINT_ERR_FAILED': '[LINT] ❌ 大模型验证运行失败: {0}',
        'LINT_ERR_CONTINUE': '\\n[LINT] ⚠️ 验证 API 调用失败，但检测到 --continue-on-error 标志，继续执行...',
        'DIFF_INIT': '\\n[DIFF] 🤖 正在启动大模型语义 Diff 分析 (语言: {0})...',
        'DIFF_ANALYZING': '[DIFF] 正在比对上下文区块: {0} tokens (旧) vs {1} tokens (新)...\\n',
        'DIFF_ERR_FAILED': '[DIFF] ❌ 大模型 Diff 分析失败: {0}',
        'DIFF_NO_CHANGES': '[DIFF] ⚪ 大模型未检测到结构性或重大的语义变化。',
        'DIFF_RESULT_PREFIX': '[DIFF] 📝 变更分析报告:\\n{0}\\n',
    },
};

export function consoleT(key: string, ...args: (string | number)[]): string {
    const lang = getCurrentLang();
    const dict = dictionaries[lang] || dictionaries.en;
    let str = dict[key] || dictionaries.en[key] || key;

    for (let i = 0; i < args.length; i++) {
        str = str.replace(`{${i}}`, String(args[i]));
    }

    return str;
}

export function getVerifyLang(): string {
    return consoleT('verify.lang');
}
