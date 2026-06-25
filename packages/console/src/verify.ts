import { generateText } from 'ai';
import { getLLMModel } from './llmProvider';
import * as crypto from 'crypto';
import { estimateTokens } from '../../core/src/utils';
import verifyCriteria from './verify-criteria.md';
import { consoleT, getVerifyLang } from './i18n';

const LINT_PROMPT = `
你是 VASMC，一个专为 LLM 时代设计的高级 AI 编译器与静态分析器。
你的任务是分析以下已组装完毕的 Markdown 上下文（该上下文将被用作 Prompt），并检测其中存在的问题。

${verifyCriteria.trim()}

如果发现任何问题，请清晰列出问题的大致位置/上下文、问题类型及你的判断理由。
请使用以下语言回复：{VERIFY_LANG}。

重要：你必须在回复的最后一行输出严重程度标记：
- 若无任何问题：最后一行输出 "LINT_PASS"。
- 若仅有轻度问题（指令冲突、人格分裂、逻辑冗余）：最后一行输出 "LINT_WARN"。
- 若存在严重问题（系统破坏风险）：最后一行输出 "LINT_BLOCK"。

输出格式（若发现问题）：
🚨 [指令冲突]
问题：<简短描述>
理由：<详细说明>

⚠️ [系统破坏风险]
问题：<简短描述>
理由：<详细说明>

💡 [逻辑冗余 / 信息]
问题：<简短描述>
理由：<详细说明>

=== 编译上下文开始 ===
{CONTENT}
=== 编译上下文结束 ===
`;



// Simple in-memory cache to avoid re-verifying the exact same content in one run if needed,
// though usually the CLI runs once per command. We can build a file cache later.
let lastVerifiedHash: string = '';

export interface VerifyResult {
    passed: boolean;
    error?: boolean;
}

export async function verifyCompiledContent(content: string, modelOverride?: string): Promise<VerifyResult> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (hash === lastVerifiedHash) return { passed: true }; // unchanged

    const finalLang = getVerifyLang();

    console.log(consoleT('LINT_INIT', finalLang));
    console.log(consoleT('LINT_ANALYZING', content.length));

    try {
        const { text } = await generateText({
            model: getLLMModel(modelOverride),
            prompt: LINT_PROMPT.replace('{CONTENT}', content).replace('{VERIFY_LANG}', finalLang),
        });

        const lines = text.trim().split('\n');
        const lastLine = lines[lines.length - 1].trim();

        if (lastLine === 'LINT_PASS') {
            console.log(consoleT('LINT_PASS'));
            lastVerifiedHash = hash;
            return { passed: true };
        } else if (lastLine === 'LINT_WARN') {
            console.log(text.replace('LINT_WARN', '').trim());
            console.log(consoleT('LINT_WARN'));
            lastVerifiedHash = hash;
            return { passed: true };
        } else if (lastLine === 'LINT_BLOCK') {
            console.log(text.replace('LINT_BLOCK', '').trim());
            console.log(consoleT('LINT_BLOCK'));
            return { passed: false }; // blocks the build correctly
        } else {
            console.log(text);
            console.log(consoleT('LINT_UNKNOWN'));
            return { passed: false, error: true }; // Unknown output format acts as an error
        }
    } catch (e: any) {
        console.error(consoleT('LINT_ERR_FAILED', e.message));
        return { passed: false, error: true }; // True API failure
    }
}

const DIFF_PROMPT = `
You are VASMC, an expert AI Semantic Diff Analyzer for Prompt Engineering.
You are given two versions of a compiled Prompt (Old and New).
Your task is to analyze the semantic and structural differences between them.

Focus on:
1. Did the core persona or system constraints change?
2. Were any critical rules added or removed?
3. Did the tone or specific instructions shift?

Provide a concise, human-readable summary of the IMPACT of these changes. Do not just list text diffs; explain what the change MEANS for the LLM that will consume this prompt.
If the changes are purely superficial (e.g., whitespace, exact synonyms) and do not alter the prompt's structural behavior, state that "No structural or semantic changes detected".

Please explain the analysis using the following language: {VERIFY_LANG}.

=== OLD PROMPT CONTEXT START ===
{OLD_CONTENT}
=== OLD PROMPT CONTEXT END ===

=== NEW PROMPT CONTEXT START ===
{NEW_CONTENT}
=== NEW PROMPT CONTEXT END ===
`;

export async function analyzeSemanticDiff(oldContent: string, newContent: string, modelOverride?: string): Promise<void> {
    const finalLang = getVerifyLang();

    console.log(consoleT('DIFF_INIT', finalLang));

    const countOld = estimateTokens(oldContent);
    const countNew = estimateTokens(newContent);

    console.log(consoleT('DIFF_ANALYZING', countOld, countNew));

    try {
        const { text } = await generateText({
            model: getLLMModel(modelOverride),
            prompt: DIFF_PROMPT.replace('{OLD_CONTENT}', oldContent).replace('{NEW_CONTENT}', newContent).replace('{VERIFY_LANG}', finalLang),
        });

        if (text.trim().toLowerCase().includes('no structural or semantic changes')) {
            console.log(consoleT('DIFF_NO_CHANGES'));
        } else {
            console.log(consoleT('DIFF_RESULT_PREFIX', text.trim()));
        }
    } catch (e: any) {
        console.error(consoleT('DIFF_ERR_FAILED', e.message));
    }
}
