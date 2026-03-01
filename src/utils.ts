import { francAll } from 'franc-min';

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
 * Returns the best match ISO code (e.g. 'en', 'zh-CN') if confidence is high enough.
 */
export function detectLanguage(text: string, threshold = 0.4): string | undefined {
    // Determine if it actually contains translatable-looking prose
    const cleanText = text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1') // Extract text from links, drop URLs
        .replace(/[#*`>_-]/g, '')                // Drop markdown formatting
        .trim();

    const hasText = /[a-zA-Z0-9\u4e00-\u9fa5]/.test(cleanText);
    if (!hasText) return undefined;

    const topLanguages = francAll(cleanText.substring(0, 5000)); // Sample first 5k

    // Check if franc failed to detect or returned undetermined
    const isUndetermined = topLanguages.length === 0 || topLanguages[0][0] === 'und';

    if (isUndetermined) {
        // Fallback for extremely short strings where francAll fails completely
        if (/[\u4e00-\u9fa5]/.test(cleanText)) return 'cmn';
        if (/[\u3040-\u30ff]/.test(cleanText)) return 'jpn';
        if (/^[a-zA-Z\s.,!?]+$/.test(cleanText)) return 'eng';
        return undefined;
    }

    const [langCode, confidence] = topLanguages[0];

    // If francAll is uncertain (short text), fallback to regex heuristic
    if (confidence < threshold) {
        if (/[\u4e00-\u9fa5]/.test(cleanText)) return 'cmn';
        if (/[\u3040-\u30ff]/.test(cleanText)) return 'jpn';
    }

    if (confidence > threshold || (confidence > 0 && topLanguages.length === 1)) {
        return langCode as string;
    }

    return undefined;
}
