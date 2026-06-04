import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';

export function mergePhraseSettings(
  engineType: 'google' | 'yandex' | 'custom',
  engineSettings: Record<string, any> | null | undefined,
  phraseSettings?: IIvrPhraseTtsSettings,
): Record<string, any> {
  const base = { ...(engineSettings || {}) };
  const over = phraseSettings || {};

  if (engineType === 'google') {
    return {
      ...base,
      language_code: over.language_code ?? base.language_code ?? 'ru-RU',
      voice_name: over.voice ?? (base as any).voice_name ?? 'ru-RU-Wavenet-A',
      speaking_rate: String(over.speaking_rate ?? over.speed ?? base.speaking_rate ?? '1.0'),
    };
  }

  if (engineType === 'yandex') {
    return {
      ...base,
      voice: over.voice ?? base.voice ?? 'alena',
      role: over.role ?? base.role ?? base.emotion ?? 'neutral',
      speed: over.speed ?? base.speed ?? '1.0',
      pitch_shift: over.pitch_shift ?? base.pitch_shift,
      folder_id: base.folder_id,
    };
  }

  return { ...base, ...over };
}
