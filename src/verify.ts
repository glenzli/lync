import { generateText } from 'ai';
import { getLLMModel } from './llmProvider';
import * as crypto from 'crypto';
import { t, getVerifyLang } from './i18n';
import { estimateTokens } from './utils';

const LINT_PROMPT = `
You are Lync, an advanced AI compiler and static analyzer for the LLM era.
Your task is to analyze the following assembled Markdown context (which is intended to be used as a Prompt) and detect any of the following issues:

1. **Instruction Conflict**: Contradictory rules or instructions (e.g., formatting contradictions, mutually exclusive constraints).
2. **Persona Schizophrenia**: Inconsistent role definitions or tones across different parts of the prompt.
3. **Logic Redundancy**: Unnecessary repetitions of the same concept that waste token space.
4. **System Destruction Risk**: Instructions that explicitly attempt to execute malicious code, destroy system files, steal data, or perform unauthorized system-level operations. (Ignore abstract prompt injection or "jailbreak" attempts).

If you find ANY issues, list them clearly with the approximate location/context, the type of issue, and your reasoning.
Please explain the issues using the following language: {VERIFY_LANG}.

IMPORTANT: You must output a severity marker at the very end of your response:
- If NO issues: Output EXACTLY "LINT_PASS" on the last line.
- If only harmless issues (Conflict, Persona, Redundancy): Output EXACTLY "LINT_WARN" on the last line.
- If severe issues (System Destruction Risk): Output EXACTLY "LINT_BLOCK" on the last line.

Output format (if issues found):
🚨 [CONFLICT DETECTED]
Issue: <Short description>
Reasoning: <Detailed reasoning>

⚠️ [SYSTEM DESTRUCTION RISK]
Issue: <Short description>
Reasoning: <Detailed reasoning>

💡 [REDUNDANCY / INFO]
Issue: <Short description>
Reasoning: <Detailed reasoning>

=== COMPILED CONTEXT START ===
{CONTENT}
=== COMPILED CONTEXT END ===
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

    console.log(t('LINT_INIT', finalLang));
    console.log(t('LINT_ANALYZING', content.length));

    try {
        const { text } = await generateText({
            model: getLLMModel(modelOverride),
            prompt: LINT_PROMPT.replace('{CONTENT}', content).replace('{VERIFY_LANG}', finalLang),
        });

        const lines = text.trim().split('\n');
        const lastLine = lines[lines.length - 1].trim();

        if (lastLine === 'LINT_PASS') {
            console.log(t('LINT_PASS'));
            lastVerifiedHash = hash;
            return { passed: true };
        } else if (lastLine === 'LINT_WARN') {
            console.log(text.replace('LINT_WARN', '').trim());
            console.log(t('LINT_WARN'));
            lastVerifiedHash = hash;
            return { passed: true };
        } else if (lastLine === 'LINT_BLOCK') {
            console.log(text.replace('LINT_BLOCK', '').trim());
            console.log(t('LINT_BLOCK'));
            return { passed: false }; // blocks the build correctly
        } else {
            console.log(text);
            console.log(t('LINT_UNKNOWN'));
            return { passed: false, error: true }; // Unknown output format acts as an error
        }
    } catch (e: any) {
        console.error(t('LINT_ERR_FAILED', e.message));
        return { passed: false, error: true }; // True API failure
    }
}

const DIFF_PROMPT = `
You are Lync, an expert AI Semantic Diff Analyzer for Prompt Engineering.
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

    console.log(t('DIFF_INIT', finalLang));

    const countOld = estimateTokens(oldContent);
    const countNew = estimateTokens(newContent);

    console.log(t('DIFF_ANALYZING', countOld, countNew));

    try {
        const { text } = await generateText({
            model: getLLMModel(modelOverride),
            prompt: DIFF_PROMPT.replace('{OLD_CONTENT}', oldContent).replace('{NEW_CONTENT}', newContent).replace('{VERIFY_LANG}', finalLang),
        });

        if (text.trim().toLowerCase().includes('no structural or semantic changes')) {
            console.log(t('DIFF_NO_CHANGES'));
        } else {
            console.log(t('DIFF_RESULT_PREFIX', text.trim()));
        }
    } catch (e: any) {
        console.error(t('DIFF_ERR_FAILED', e.message));
    }
}
