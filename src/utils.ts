import { francAll } from 'franc-min';
import { encodingForModel } from 'js-tiktoken';

export const iso639_3_map: Record<string, string[]> = {
    'cmn': ['zh', 'zh-cn', 'zh-tw', 'zh-hk'],
    'eng': ['en', 'en-us', 'en-gb'],
    'jpn': ['ja'],
    'spa': ['es'],
    'fra': ['fr'],
    'deu': ['de'],
    'rus': ['ru'],
    'kor': ['ko'],
    'ita': ['it'],
    'por': ['pt', 'pt-br']
};

/**
 * Heuristically detects the primary language of the given text.
 * Returns a BCP 47 code (e.g. 'en', 'zh-CN', 'ja') if confidence is high enough.
 */
export function detectLanguage(text: string, threshold = 0.4): string | undefined {
    // Determine if it actually contains translatable-looking prose
    const cleanText = text
        .replace(/```[\s\S]*?```/g, '')              // Drop fenced code blocks (not prose)
        .replace(/`[^`]+`/g, '')                      // Drop inline code
        .replace(/<[^>]+>/g, '')                       // Drop HTML tags
        .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')      // Extract text from links, drop URLs
        .replace(/[#*`>_-]/g, '')                      // Drop markdown formatting
        .trim();

    const hasText = /[a-zA-Z0-9\u4e00-\u9fa5]/.test(cleanText);
    if (!hasText) return undefined;

    const topLanguages = francAll(cleanText.substring(0, 5000)); // Sample first 5k

    // Check if franc failed to detect or returned undetermined
    const isUndetermined = topLanguages.length === 0 || topLanguages[0][0] === 'und';

    let detected: string | undefined;

    if (isUndetermined) {
        // Fallback for extremely short strings where francAll fails completely
        if (/[\u4e00-\u9fa5]/.test(cleanText)) detected = 'cmn';
        else if (/[\u3040-\u30ff]/.test(cleanText)) detected = 'jpn';
        else if (/^[a-zA-Z\s.,!?]+$/.test(cleanText)) detected = 'eng';
        else return undefined;
    } else {
        const [langCode, confidence] = topLanguages[0];

        // If francAll is uncertain (short text), fallback to regex heuristic
        if (confidence < threshold) {
            if (/[\u4e00-\u9fa5]/.test(cleanText)) detected = 'cmn';
            else if (/[\u3040-\u30ff]/.test(cleanText)) detected = 'jpn';
        }

        if (!detected && (confidence > threshold || (confidence > 0 && topLanguages.length === 1))) {
            detected = langCode as string;
        }
    }

    if (!detected) return undefined;

    // Map ISO 639-3 (franc output) → BCP 47 (Lync standard)
    const iso639ToBcp47: Record<string, string> = {
        'eng': 'en',
        'cmn': 'zh-CN',
        'jpn': 'ja',
        'kor': 'ko',
        'fra': 'fr',
        'deu': 'de',
        'spa': 'es',
        'por': 'pt',
        'rus': 'ru',
        'ara': 'ar',
        'ita': 'it',
    };

    return iso639ToBcp47[detected] || detected;
}

/**
 * Accurately estimates the number of OpenAI tokens in a given string.
 */
export function estimateTokens(text: string): number {
    try {
        // gpt-4o and cl100k_base are standard for modern OpenAI models
        const enc = encodingForModel("gpt-4o");
        const tokens = enc.encode(text);
        return tokens.length;
    } catch (e) {
        // Fallback heuristic if js-tiktoken fails
        return Math.ceil(text.length / 4);
    }
}
