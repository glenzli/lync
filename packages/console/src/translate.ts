import { LanguageModelUsage, generateText } from 'ai';
import { getLLMModel } from './llmProvider';

export interface TranslationResult {
    text: string;
    usage?: LanguageModelUsage;
}

function createLimiter(maxConcurrent: number) {
    let active = 0;
    const queue: {
        task: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (reason?: unknown) => void;
    }[] = [];

    function runNext() {
        if (active >= maxConcurrent || queue.length === 0) return;

        const item = queue.shift()!;
        active++;
        item.task()
            .then(item.resolve, item.reject)
            .finally(() => {
                active--;
                runNext();
            });
    }

    return async function limit<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            queue.push({ task, resolve, reject });
            runNext();
        });
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Global LLM concurrency limiter: at most 2 simultaneous LLM calls across all files/langs.
const llmLimiter = createLimiter(2);

function isRateLimitError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const msg = ((e as any).message || '').toLowerCase();
    const status = (e as any).status ?? (e as any).statusCode ?? 0;
    return status === 429 || msg.includes('429') || msg.includes('rate_limit') || msg.includes('rate limit');
}

async function retryRateLimit<T>(task: () => Promise<T>, retries = 4): Promise<T> {
    const maxAttempts = retries + 1;

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
        try {
            return await task();
        } catch (e) {
            if (!isRateLimitError(e) || attemptNumber >= maxAttempts) {
                throw e;
            }

            const retriesLeft = maxAttempts - attemptNumber;
            console.warn(`[TRANSLATE] ⏳ Rate limited. Retry ${attemptNumber}/${retries}, ${retriesLeft} retries left...`);
            await sleep(1000 * Math.pow(2, attemptNumber - 1));
        }
    }

    throw new Error('Retry loop exhausted unexpectedly.');
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

        const result = await llmLimiter(() => retryRateLimit(async () => {
            const { text, usage } = await generateText({
                model: getLLMModel(modelOverride),
                system: systemPrompt,
                prompt: content,
                temperature: 0.1
            });
            return { text, usage };
        }));

        return { text: result.text.trim(), usage: result.usage };
    } catch (e: any) {
        console.error(`[TRANSLATE] ❌ Error calling LLM: ${e.message}`);
        return null;
    }
}
