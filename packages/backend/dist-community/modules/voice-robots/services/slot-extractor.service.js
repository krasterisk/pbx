"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SlotExtractorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotExtractorService = void 0;
const common_1 = require("@nestjs/common");
const fastest_levenshtein_1 = require("fastest-levenshtein");
/**
 * Slot Extractor Service — Deterministic Function Calling (no LLM).
 *
 * Extracts structured data from STT text using rule-based methods:
 * - digits:   Russian verbal numbers → numeric string
 * - phone:    Phone number patterns
 * - yes_no:   Affirmative/negative phrase dictionaries
 * - date:     Date patterns + relative date words
 * - choice:   Levenshtein matching against predefined options
 * - freetext: Raw STT text passthrough
 *
 * Performance: ~0.1ms per extraction (CPU only, no ML).
 * Reliability: 100% deterministic — same input always gives same output.
 */
let SlotExtractorService = class SlotExtractorService {
    static { SlotExtractorService_1 = this; }
    logger = new common_1.Logger(SlotExtractorService_1.name);
    /**
     * Extract a slot value from STT-recognized text.
     */
    extract(text, slot) {
        const normalized = text.toLowerCase().trim();
        switch (slot.type) {
            case 'digits':
                return this.extractDigits(normalized, slot.name);
            case 'phone':
                return this.extractPhone(normalized);
            case 'yes_no':
                return this.extractYesNo(normalized);
            case 'date':
                return this.extractDate(normalized);
            case 'choice':
                return this.extractChoice(normalized, slot.choices || []);
            case 'freetext':
                return {
                    success: normalized.length > 0,
                    value: text.trim(),
                    rawText: text,
                    confidence: normalized.length > 0 ? 1.0 : 0,
                };
            default:
                return { success: false, rawText: text, confidence: 0 };
        }
    }
    // ─── Digits extraction ─────────────────────────────────
    /** Map of Russian verbal numbers → numeric values */
    static VERBAL_NUMBERS = {
        'ноль': 0, 'нуль': 0,
        'один': 1, 'одна': 1, 'одно': 1, 'раз': 1,
        'два': 2, 'две': 2,
        'три': 3,
        'четыре': 4,
        'пять': 5,
        'шесть': 6,
        'семь': 7,
        'восемь': 8,
        'девять': 9,
        'десять': 10,
        'одиннадцать': 11,
        'двенадцать': 12,
        'тринадцать': 13,
        'четырнадцать': 14,
        'пятнадцать': 15,
        'шестнадцать': 16,
        'семнадцать': 17,
        'восемнадцать': 18,
        'девятнадцать': 19,
        'двадцать': 20,
        'тридцать': 30,
        'сорок': 40,
        'пятьдесят': 50,
        'шестьдесят': 60,
        'семьдесят': 70,
        'восемьдесят': 80,
        'девяносто': 90,
        'сто': 100,
        'двести': 200,
        'триста': 300,
        'четыреста': 400,
        'пятьсот': 500,
        'шестьсот': 600,
        'семьсот': 700,
        'восемьсот': 800,
        'девятьсот': 900,
        'тысяча': 1000, 'тысячу': 1000, 'тысячи': 1000,
    };
    /**
     * Extract digits from verbal Russian numbers or mixed text.
     * "двенадцать тридцать четыре" → "1234"
     * "один два три" → "123"  (single digits concatenated)
     * "455" → "455" (passthrough numeric)
     */
    extractDigits(text, slotName) {
        // Contextual pre-filtering: for named slots, extract text after relevant markers
        // e.g. "красноярск строительная 18 квартира 8" → extract "8" for apartment slot
        let effectiveText = text;
        if (slotName) {
            const markerMap = {
                'apartment': /(?:квартир[аы]|кв\.?\s*)\s*/gi,
                'house': /(?:дом|д\.?\s*)\s*/gi,
            };
            const marker = markerMap[slotName];
            if (marker) {
                // Find the LAST occurrence of the marker and take text after it
                let lastIndex = -1;
                let match;
                while ((match = marker.exec(text)) !== null) {
                    lastIndex = match.index + match[0].length;
                }
                if (lastIndex > 0 && lastIndex < text.length) {
                    effectiveText = text.substring(lastIndex).trim();
                }
            }
        }
        // 1. Try direct numeric extraction (STT sometimes returns digits)
        const directDigits = effectiveText.replace(/[^\d]/g, '');
        if (directDigits.length > 0) {
            return {
                success: true,
                value: directDigits,
                rawText: text,
                confidence: 1.0,
            };
        }
        // 2. Parse Russian verbal numbers
        const words = effectiveText.split(/\s+/).filter(w => w.length > 0);
        const numbers = [];
        let accumulated = 0;
        let hasNumber = false;
        for (const word of words) {
            const cleanWord = word.replace(/[^а-яё]/g, '');
            if (!cleanWord)
                continue;
            const num = SlotExtractorService_1.VERBAL_NUMBERS[cleanWord];
            if (num !== undefined) {
                hasNumber = true;
                // Single digits (0-9) → concatenate directly (for phone/account numbers)
                if (num <= 9 && accumulated === 0) {
                    numbers.push(num);
                }
                // Tens/hundreds/thousands → accumulate for compound numbers
                else if (num >= 100 && num < 1000) {
                    accumulated += num;
                }
                else if (num >= 1000) {
                    accumulated = (accumulated || 1) * num;
                }
                else if (num >= 10) {
                    // Check if previous accumulation has hundreds
                    accumulated += num;
                }
                else {
                    // Single digit after tens (e.g. двадцать + один = 21)
                    accumulated += num;
                }
            }
            else {
                // Flush accumulated compound number
                if (accumulated > 0) {
                    numbers.push(accumulated);
                    accumulated = 0;
                }
            }
        }
        // Flush remaining
        if (accumulated > 0) {
            numbers.push(accumulated);
        }
        if (!hasNumber) {
            return { success: false, rawText: text, confidence: 0 };
        }
        const result = numbers.join('');
        return {
            success: true,
            value: result,
            rawText: text,
            confidence: 0.9,
        };
    }
    // ─── Phone extraction ──────────────────────────────────
    /**
     * Extract phone number from text.
     * Supports: +7XXXXXXXXXX, 8XXXXXXXXXX, verbal digits.
     */
    extractPhone(text) {
        // Try regex first
        const phoneRegex = /(?:\+?[78])[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/;
        const match = text.match(phoneRegex);
        if (match) {
            const phone = `+7${match[1]}${match[2]}${match[3]}${match[4]}`;
            return { success: true, value: phone, rawText: text, confidence: 1.0 };
        }
        // Fallback to digits extraction
        const digitsResult = this.extractDigits(text);
        if (digitsResult.success && typeof digitsResult.value === 'string') {
            const digits = digitsResult.value;
            if (digits.length >= 10 && digits.length <= 11) {
                const phone = digits.startsWith('8') || digits.startsWith('7')
                    ? `+7${digits.slice(-10)}`
                    : `+7${digits}`;
                return { success: true, value: phone, rawText: text, confidence: 0.8 };
            }
        }
        return { success: false, rawText: text, confidence: 0 };
    }
    // ─── Yes/No extraction ─────────────────────────────────
    static YES_WORDS = [
        'да', 'конечно', 'разумеется', 'верно', 'правильно',
        'согласен', 'согласна', 'подтверждаю', 'ага', 'угу',
        'точно', 'именно', 'хорошо', 'ладно', 'окей', 'ок',
        'давай', 'давайте', 'пожалуй', 'естественно',
    ];
    static NO_WORDS = [
        'нет', 'не', 'неа', 'нету', 'отказ', 'отказываюсь',
        'не надо', 'не нужно', 'не хочу', 'не буду', 'ни в коем',
        'никогда', 'отмена', 'стоп', 'хватит',
    ];
    /**
     * Extract yes/no boolean from text.
     */
    extractYesNo(text) {
        const words = text.split(/\s+/);
        // Check negative first (more specific)
        for (const noPhrase of SlotExtractorService_1.NO_WORDS) {
            if (text.includes(noPhrase)) {
                return { success: true, value: false, rawText: text, confidence: 0.95 };
            }
        }
        for (const yesWord of SlotExtractorService_1.YES_WORDS) {
            for (const word of words) {
                if (word === yesWord || this.fuzzyMatch(word, yesWord, 0.8)) {
                    return { success: true, value: true, rawText: text, confidence: 0.95 };
                }
            }
        }
        return { success: false, rawText: text, confidence: 0 };
    }
    // ─── Date extraction ───────────────────────────────────
    static RELATIVE_DATES = {
        'сегодня': (now) => now,
        'завтра': (now) => new Date(now.getTime() + 86400000),
        'послезавтра': (now) => new Date(now.getTime() + 2 * 86400000),
        'вчера': (now) => new Date(now.getTime() - 86400000),
        'позавчера': (now) => new Date(now.getTime() - 2 * 86400000),
    };
    static MONTHS = {
        'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3,
        'ма': 4, 'июн': 5, 'июл': 6, 'август': 7,
        'сентябр': 8, 'октябр': 9, 'ноябр': 10, 'декабр': 11,
    };
    /**
     * Extract date from text.
     * Supports: "завтра", "15 апреля", "2025-04-15".
     */
    extractDate(text) {
        const now = new Date();
        // ISO date passthrough
        const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return { success: true, value: isoMatch[0], rawText: text, confidence: 1.0 };
        }
        // Relative dates
        for (const [word, resolver] of Object.entries(SlotExtractorService_1.RELATIVE_DATES)) {
            if (text.includes(word)) {
                const date = resolver(now);
                return {
                    success: true,
                    value: date.toISOString().split('T')[0],
                    rawText: text,
                    confidence: 0.95,
                };
            }
        }
        // "15 апреля", "3 марта"
        const dateRegex = /(\d{1,2})\s+([а-яё]+)/;
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const monthWord = dateMatch[2];
            for (const [prefix, monthIdx] of Object.entries(SlotExtractorService_1.MONTHS)) {
                if (monthWord.startsWith(prefix)) {
                    const year = now.getFullYear();
                    const date = new Date(year, monthIdx, day);
                    // If date is in the past, assume next year
                    if (date < now)
                        date.setFullYear(year + 1);
                    return {
                        success: true,
                        value: date.toISOString().split('T')[0],
                        rawText: text,
                        confidence: 0.9,
                    };
                }
            }
        }
        return { success: false, rawText: text, confidence: 0 };
    }
    // ─── Choice extraction ─────────────────────────────────
    /**
     * Extract a choice from predefined options using Levenshtein similarity.
     */
    extractChoice(text, choices) {
        if (choices.length === 0) {
            return { success: false, rawText: text, confidence: 0 };
        }
        let bestChoice = null;
        let bestSimilarity = 0;
        for (const choice of choices) {
            // Check canonical value
            const valueSim = this.phraseSimilarity(text, choice.value.toLowerCase());
            if (valueSim > bestSimilarity) {
                bestSimilarity = valueSim;
                bestChoice = choice;
            }
            // Check all synonyms
            for (const synonym of choice.synonyms) {
                const synSim = this.phraseSimilarity(text, synonym.toLowerCase());
                if (synSim > bestSimilarity) {
                    bestSimilarity = synSim;
                    bestChoice = choice;
                }
            }
        }
        if (bestChoice && bestSimilarity >= 0.6) {
            return {
                success: true,
                value: bestChoice.value,
                rawText: text,
                confidence: bestSimilarity,
            };
        }
        return { success: false, rawText: text, confidence: 0 };
    }
    // ─── Utilities ─────────────────────────────────────────
    /**
     * Phrase-level similarity: checks if target phrase is contained in text
     * or measures overall word overlap.
     */
    phraseSimilarity(text, phrase) {
        // Exact containment
        if (text.includes(phrase))
            return 1.0;
        const textWords = text.split(/\s+/);
        const phraseWords = phrase.split(/\s+/);
        let matched = 0;
        for (const pw of phraseWords) {
            for (const tw of textWords) {
                if (this.fuzzyMatch(tw, pw, 0.75)) {
                    matched++;
                    break;
                }
            }
        }
        return phraseWords.length > 0 ? matched / phraseWords.length : 0;
    }
    /**
     * Fuzzy match two words using Levenshtein distance.
     */
    fuzzyMatch(a, b, threshold) {
        if (a === b)
            return true;
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0)
            return true;
        const similarity = 1 - (0, fastest_levenshtein_1.distance)(a, b) / maxLen;
        return similarity >= threshold;
    }
};
exports.SlotExtractorService = SlotExtractorService;
exports.SlotExtractorService = SlotExtractorService = SlotExtractorService_1 = __decorate([
    (0, common_1.Injectable)()
], SlotExtractorService);
//# sourceMappingURL=slot-extractor.service.js.map