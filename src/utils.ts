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
    const hasText = /[a-zA-Z0-9\u4e00-\u9fa5]/.test(text);
    if (!hasText) return undefined;

    const topLanguages = francAll(text.substring(0, 5000)); // Sample first 5k
    if (topLanguages.length === 0) return undefined;

    const [langCode, confidence] = topLanguages[0];

    if (confidence > threshold) {
        const mappedTargets = iso639_3_map[langCode as string] || [];
        // Return the first one (usually the standard/common one like 'en' or 'zh-CN')
        return mappedTargets[0];
    }

    return undefined;
}
