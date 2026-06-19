import type { IIvrPhrase, IIvrPhraseTtsSettings } from '../types/ivr-phrase.types';

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

export type IvrPhraseValidationCode =
  | 'audio_filename_missing'
  | 'tts_text_missing'
  | 'tts_engine_missing'
  | 'tts_engine_not_found'
  | 'tts_params_missing';

export interface IvrPhraseValidationIssue {
  index: number;
  code: IvrPhraseValidationCode;
}

export interface IvrPromptsValidationEngine {
  uid: number;
  type: 'google' | 'yandex' | 'custom' | string;
  settings?: Record<string, unknown>;
}

export interface ValidateIvrPromptsOptions {
  engines?: IvrPromptsValidationEngine[];
}

function phraseHasRequiredTtsParams(
  engine: IvrPromptsValidationEngine,
  phraseSettings?: IIvrPhraseTtsSettings,
): boolean {
  const s = engine.settings || {};
  const p = phraseSettings || {};
  if (engine.type === 'google') {
    return Boolean(String(p.voice ?? s.voice_name ?? '').trim());
  }
  if (engine.type === 'yandex') {
    return Boolean(String(p.voice ?? s.voice ?? '').trim());
  }
  return true;
}

export function getIvrPromptsValidationIssues(
  prompts: IIvrPhrase[],
  options?: ValidateIvrPromptsOptions,
): IvrPhraseValidationIssue[] {
  const issues: IvrPhraseValidationIssue[] = [];
  const engines = options?.engines;

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    if (p.kind === 'audio') {
      if (!p.filename?.trim()) {
        issues.push({ index: i, code: 'audio_filename_missing' });
      }
      continue;
    }

    if (!p.text?.trim()) {
      issues.push({ index: i, code: 'tts_text_missing' });
    }
    if (!p.engine_uid || p.engine_uid <= 0) {
      issues.push({ index: i, code: 'tts_engine_missing' });
      continue;
    }

    if (!engines) continue;

    const engine = engines.find((e) => e.uid === p.engine_uid);
    if (!engine) {
      issues.push({ index: i, code: 'tts_engine_not_found' });
      continue;
    }
    if (!phraseHasRequiredTtsParams(engine, p.settings)) {
      issues.push({ index: i, code: 'tts_params_missing' });
    }
  }

  return issues;
}

const VALIDATION_MESSAGES: Record<IvrPhraseValidationCode, string> = {
  audio_filename_missing: 'Phrase {n}: audio filename is required',
  tts_text_missing: 'Phrase {n}: TTS text is required',
  tts_engine_missing: 'Phrase {n}: TTS engine is required',
  tts_engine_not_found: 'Phrase {n}: TTS engine not found',
  tts_params_missing: 'Phrase {n}: TTS voice/parameters are required',
};

export class IvrPromptsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IvrPromptsValidationError';
  }
}

export function assertIvrPromptsForSave(
  prompts: IIvrPhrase[],
  options?: ValidateIvrPromptsOptions,
): void {
  const issues = getIvrPromptsValidationIssues(prompts, options);
  if (issues.length > 0) {
    const first = issues[0];
    const template = VALIDATION_MESSAGES[first.code];
    throw new IvrPromptsValidationError(
      template.replace('{n}', String(first.index + 1)),
    );
  }
}
