import type { IIvrPhrase } from '../types/ivr-phrase.types';

export function isValidIvrPhrase(p: unknown): p is IIvrPhrase {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  if (o.kind === 'audio') {
    return typeof o.filename === 'string' && o.filename.length > 0;
  }
  if (o.kind === 'tts') {
    return typeof o.text === 'string' && typeof o.engine_uid === 'number';
  }
  return false;
}

/**
 * Converts legacy string[] / tts: prefix / object[] to IIvrPhrase[].
 */
export function normalizeIvrPrompts(input: unknown): IIvrPhrase[] {
  if (!Array.isArray(input)) return [];

  const result: IIvrPhrase[] = [];

  for (const item of input) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('tts:')) {
        result.push({
          kind: 'tts',
          text: trimmed.slice(4),
          engine_uid: 0,
        });
      } else {
        result.push({ kind: 'audio', filename: trimmed });
      }
      continue;
    }

    if (isValidIvrPhrase(item)) {
      if (item.kind === 'audio') {
        result.push({ kind: 'audio', filename: item.filename.trim() });
      } else {
        result.push({
          kind: 'tts',
          text: item.text.trim(),
          engine_uid: Number(item.engine_uid) || 0,
          settings: item.settings,
        });
      }
    }
  }

  return result;
}

export class IvrPromptsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IvrPromptsValidationError';
  }
}

export function assertIvrPromptsForSave(prompts: IIvrPhrase[]): void {
  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    if (p.kind === 'audio') {
      if (!p.filename?.trim()) {
        throw new IvrPromptsValidationError(`Phrase ${i + 1}: audio filename is required`);
      }
      continue;
    }
    if (!p.text?.trim()) {
      throw new IvrPromptsValidationError(`Phrase ${i + 1}: TTS text is required`);
    }
    if (!p.engine_uid || p.engine_uid <= 0) {
      throw new IvrPromptsValidationError(`Phrase ${i + 1}: TTS engine is required`);
    }
  }
}
