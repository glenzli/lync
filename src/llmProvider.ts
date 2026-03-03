import { createOpenAI } from '@ai-sdk/openai';
import { loadVasmRc } from './config';
import * as dotenv from 'dotenv';

/**
 * Resolves the configuration and initializes an OpenAI-compatible provider instance.
 * Priority: 1. ENV Variables -> 2. .vasmrc (Local -> Global) -> 3. Defaults
 */
export function getLLMModel(modelOverride?: string) {
    if (process.env.DOTENV_CONFIG_QUIET === undefined) {
        process.env.DOTENV_CONFIG_QUIET = 'true';
    }
    dotenv.config();
    const rcConfig = loadVasmRc();

    // 1. Resolve API Key
    const apiKey =
        process.env.VASM_LLM_API_KEY ||
        process.env.OPENAI_API_KEY ||
        rcConfig?.llm?.apiKey;

    // 2. Resolve Base URL (Custom OpenAI compatible endpoints)
    const baseURL =
        process.env.VASM_LLM_BASE_URL ||
        rcConfig?.llm?.baseURL;

    // 3. Resolve Model Name
    const modelName =
        modelOverride ||
        process.env.VASM_LLM_MODEL ||
        rcConfig?.llm?.model ||
        'gpt-4o'; // Default fallback

    if (!apiKey) {
        throw new Error('LLM API Key is missing. Please set VASM_LLM_API_KEY or OPENAI_API_KEY in your environment, or configure `llm.apiKey` in .vasmrc.');
    }

    // Create a custom OpenAI provider instance
    const customOpenAI = createOpenAI({
        apiKey: apiKey,
        baseURL: baseURL, // If undefined, it falls back to standard OpenAI endpoint
    });

    return customOpenAI.chat(modelName);
}
