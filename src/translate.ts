import { LanguageModelUsage, generateText } from 'ai';
import { getLLMModel } from './llmProvider';

export interface TranslationResult {
    text: string;
    usage?: LanguageModelUsage;
}

export async function translateMarkdownContent(content: string, targetLang: string, modelOverride?: string): Promise<TranslationResult | null> {

    const systemPrompt = `You are an expert AI localization engine specifically designed for translating Markdown prompt templates.
Your task is to translate the provided Markdown text into the target language: ${targetLang}.

### STRICT RULES:
1. Translate ONLY the natural language instructions and prose.
2. DO NOT translate any Lync import directives (e.g., \`[Link](lync:some-alias "@import:inline")\`). They must remain exactly as they are.
3. DO NOT translate any code blocks, variable placeholders (e.g., \`{{variable}}\`, \`$\{variable\}\`), or JSON structures unless explicitly asked in the prose.
4. Maintain the exact same Markdown formatting, heading levels, lists, and spacing.
5. Do not add any conversational preamble or postscript (like "Here is the translation:"). Output ONLY the translated Markdown.`;

    try {
        console.log(`[TRANSLATE] 🌐 Translating content to ${targetLang}...`);

        const { text, usage } = await generateText({
            model: getLLMModel(modelOverride),
            system: systemPrompt,
            prompt: content,
            temperature: 0.1
        });

        return { text: text.trim(), usage };
    } catch (e: any) {
        console.error(`[TRANSLATE] ❌ Error calling OpenAI: ${e.message}`);
        return null;
    }
}
