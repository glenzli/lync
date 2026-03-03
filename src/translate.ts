import { LanguageModelUsage, generateText } from 'ai';
import { getLLMModel } from './llmProvider';
import pLimit from 'p-limit';
import pRetry, { AbortError, RetryContext } from 'p-retry';

export interface TranslationResult {
    text: string;
    usage?: LanguageModelUsage;
}

// Global LLM concurrency limiter: at most 2 simultaneous LLM calls across all files/langs.
const llmLimiter = pLimit(2);

function isRateLimitError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const msg = ((e as any).message || '').toLowerCase();
    const status = (e as any).status ?? (e as any).statusCode ?? 0;
    return status === 429 || msg.includes('429') || msg.includes('rate_limit') || msg.includes('rate limit');
}

export async function translateMarkdownContent(content: string, targetLang: string, modelOverride?: string): Promise<TranslationResult | null> {

    const systemPrompt = `You are an expert AI localization engine specifically designed for translating Markdown prompt templates.
Your task is to translate the provided Markdown text into the target language: ${targetLang}.

### STRICT RULES:
1. Translate ONLY the natural language instructions and prose.
2. DO NOT translate any VASMC import directives (e.g., \`[Link](vasm:some-alias "@import:inline")\`). They must remain exactly as they are.
3. DO NOT translate any code blocks, variable placeholders (e.g., \`{{variable}}\`, \`\${variable}\`), or JSON structures unless explicitly asked in the prose.
4. Maintain the exact same Markdown formatting, heading levels, lists, and spacing.
5. Do not add any conversational preamble or postscript (like "Here is the translation:"). Output ONLY the translated Markdown.`;

    try {
        console.log(`[TRANSLATE] 🌐 Translating content to ${targetLang}...`);

        const result = await llmLimiter(() =>
            pRetry(
                async () => {
                    const { text, usage } = await generateText({
                        model: getLLMModel(modelOverride),
                        system: systemPrompt,
                        prompt: content,
                        temperature: 0.1
                    });
                    return { text, usage };
                },
                {
                    retries: 4,
                    factor: 2,
                    minTimeout: 1000,
                    onFailedAttempt: (ctx: RetryContext) => {
                        if (!isRateLimitError(ctx.error)) {
                            // Non-rate-limit error: abort retry immediately
                            throw new AbortError(ctx.error);
                        }
                        console.warn(`[TRANSLATE] ⏳ Rate limited. Retry ${ctx.attemptNumber}/4, ${ctx.retriesLeft} retries left...`);
                    },
                    shouldRetry: (ctx: RetryContext) => isRateLimitError(ctx.error),
                }
            )
        );

        return { text: result.text.trim(), usage: result.usage };
    } catch (e: any) {
        console.error(`[TRANSLATE] ❌ Error calling LLM: ${e.message}`);
        return null;
    }
}
