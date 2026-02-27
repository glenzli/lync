import { createOpenAI } from '@ai-sdk/openai';
import { loadLyncRc } from './config';
import * as dotenv from 'dotenv';

/**
 * Resolves the configuration and initializes an OpenAI-compatible provider instance.
 * Priority: 1. ENV Variables -> 2. .lyncrc (Local -> Global) -> 3. Defaults
 */
export function getLLMModel(modelOverride?: string) {
    dotenv.config();
    const rcConfig = loadLyncRc();

    // 1. Resolve API Key
    const apiKey =
        process.env.LYNC_LLM_API_KEY ||
        process.env.OPENAI_API_KEY ||
        rcConfig?.llm?.apiKey;

    // 2. Resolve Base URL (Custom OpenAI compatible endpoints)
    const baseURL =
        process.env.LYNC_LLM_BASE_URL ||
        rcConfig?.llm?.baseURL;

    // 3. Resolve Model Name
    const modelName =
        modelOverride ||
        process.env.LYNC_LLM_MODEL ||
        rcConfig?.llm?.model ||
        'gpt-4o'; // Default fallback

    if (!apiKey) {
        throw new Error('LLM API Key is missing. Please set LYNC_LLM_API_KEY or OPENAI_API_KEY in your environment, or configure `llm.apiKey` in .lyncrc.');
    }

    // Create a custom OpenAI provider instance
    const customOpenAI = createOpenAI({
        apiKey: apiKey,
        baseURL: baseURL, // If undefined, it falls back to standard OpenAI endpoint
    });

    return customOpenAI.chat(modelName);
}
