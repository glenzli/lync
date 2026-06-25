import { francAll } from 'franc-min';

export interface LanguageDetection {
    language: string;
    confidence: number;
    source: 'script' | 'franc';
    sampleLength: number;
    margin?: number;
}

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

const ISO639_TO_BCP47: Record<string, string> = {
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

function countMatches(text: string, regex: RegExp): number {
    return text.match(regex)?.length ?? 0;
}

function cleanMarkdownForLanguageDetection(text: string): string {
    return text
        .replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
        .replace(/```[\s\S]*?```/g, '')              // Drop fenced code blocks (not prose)
        .replace(/`[^`]+`/g, '')                      // Drop inline code
        .replace(/<!--[\s\S]*?-->/g, '')              // Drop compiler markers and comments
        .replace(/<[^>]+>/g, '')                      // Drop HTML tags
        .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')      // Extract text from links, drop URLs
        .replace(/https?:\/\/\S+/g, '')               // Drop bare URLs
        .replace(/[#*`>_\-|{}[\]().,:;!?'"“”‘’]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function detectLanguageDetails(text: string, threshold = 0.75): LanguageDetection | undefined {
    const cleanText = cleanMarkdownForLanguageDetection(text);
    const cjkChars = countMatches(cleanText, /[\u3400-\u9fff\uf900-\ufaff]/g);
    const kanaChars = countMatches(cleanText, /[\u3040-\u30ff]/g);
    const hangulChars = countMatches(cleanText, /[\uac00-\ud7af]/g);
    const latinChars = countMatches(cleanText, /[a-zA-Z]/g);
    const signalChars = cjkChars + kanaChars + hangulChars + latinChars;

    if (signalChars === 0) return undefined;

    const sample = cleanText.substring(0, 5000);
    const sampleLength = sample.length;
    const minSignalChars = 12;

    // Script-based inference is reliable for CJK-family text even when franc is uncertain.
    if (signalChars >= minSignalChars || cjkChars + kanaChars + hangulChars >= 2) {
        const hangulRatio = hangulChars / signalChars;
        const japaneseRatio = (kanaChars + cjkChars) / signalChars;
        const cjkRatio = cjkChars / signalChars;

        if (hangulRatio >= 0.35) {
            return { language: 'ko', confidence: hangulRatio, source: 'script', sampleLength };
        }
        if (kanaChars > 0 && japaneseRatio >= 0.55) {
            return { language: 'ja', confidence: japaneseRatio, source: 'script', sampleLength };
        }
        if (kanaChars === 0 && cjkRatio >= 0.55) {
            return { language: 'zh-CN', confidence: cjkRatio, source: 'script', sampleLength };
        }
    }

    const latinWords = cleanText.match(/[a-zA-Z]{2,}/g)?.length ?? 0;
    const enoughLatinProse = latinChars >= 24 || latinWords >= 4;
    if (!enoughLatinProse) return undefined;

    const ranked = francAll(sample).filter(([lang]) => lang !== 'und');
    if (ranked.length === 0) return undefined;

    const [topLang, topScore] = ranked[0];
    const secondScore = ranked[1]?.[1] ?? 0;
    const margin = topScore - secondScore;
    const minMargin = 0.06;

    if (topScore < threshold || margin < minMargin) return undefined;

    return {
        language: ISO639_TO_BCP47[topLang] || topLang,
        confidence: topScore,
        source: 'franc',
        sampleLength,
        margin,
    };
}

/**
 * Heuristically detects the primary language of the given text.
 * Returns a BCP 47 code (e.g. 'en', 'zh-CN', 'ja') if confidence is high enough.
 */
export function detectLanguage(text: string, threshold = 0.75): string | undefined {
    return detectLanguageDetails(text, threshold)?.language;
}

/**
 * Estimates token count without pulling in a model-specific tokenizer.
 * This is used for warnings and variant comparison, not billing or hard limits.
 */
export function estimateTokens(text: string): number {
    let asciiChars = 0;
    let cjkChars = 0;
    let otherChars = 0;

    for (const char of text) {
        if (/[\u3400-\u9fff\uf900-\ufaff]/.test(char)) {
            cjkChars++;
        } else if (char.charCodeAt(0) <= 0x7f) {
            asciiChars++;
        } else {
            otherChars++;
        }
    }

    return Math.ceil((asciiChars / 4) + (cjkChars * 1.2) + (otherChars / 2));
}
