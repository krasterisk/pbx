export const AI_PRODUCT_CODES = ['speech_analytics', 'ai_voice_robots'] as const;
export type AiProductCode = (typeof AI_PRODUCT_CODES)[number];

export function isAiProductCode(code: string): code is AiProductCode {
  return AI_PRODUCT_CODES.some((product) => product === code);
}
