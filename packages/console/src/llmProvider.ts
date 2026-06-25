import { createOpenAI } from '@ai-sdk/openai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'yaml';

interface ConsoleRc {
    llm?: {
        model?: string;
        apiKey?: string;
        baseURL?: string;
    };
}

function loadConsoleRc(): ConsoleRc {
    let rcConfig: ConsoleRc = {};

    for (const rcPath of [path.resolve(os.homedir(), '.vasmrc'), path.resolve(process.cwd(), '.vasmrc')]) {
        if (!fs.existsSync(rcPath)) continue;
        try {
            const parsed = yaml.parse(fs.readFileSync(rcPath, 'utf8'));
            if (parsed) {
                rcConfig = {
                    ...rcConfig,
                    ...parsed,
                    llm: { ...rcConfig.llm, ...parsed.llm },
                };
            }
        } catch (e) {
            console.warn(`[WARN] Failed to parse ${rcPath}: ${e}`);
        }
    }

    return rcConfig;
}

/**
 * Resolves the configuration and initializes an OpenAI-compatible provider instance.
 * Priority: 1. ENV Variables -> 2. .vasmrc (Local -> Global) -> 3. Defaults
 */
export function getLLMModel(modelOverride?: string) {
    if (process.env.DOTENV_CONFIG_QUIET === undefined) {
        process.env.DOTENV_CONFIG_QUIET = 'true';
    }
    dotenv.config();
    const rcConfig = loadConsoleRc();

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
