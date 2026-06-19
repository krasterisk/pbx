import type { IvrPhraseValidationIssue } from '@krasterisk/shared';
import type { TFunction } from 'i18next';

export function getPhraseValidationMessage(
  issue: IvrPhraseValidationIssue,
  t: TFunction,
): string {
  const n = issue.index + 1;
  switch (issue.code) {
    case 'audio_filename_missing':
      return t('ivrs.prompts.validation.audioFilename', {
        n,
        defaultValue: 'Фраза {{n}}: не выбран аудиофайл',
      });
    case 'tts_text_missing':
      return t('ivrs.prompts.validation.ttsText', {
        n,
        defaultValue: 'Фраза {{n}}: укажите текст TTS',
      });
    case 'tts_engine_missing':
      return t('ivrs.prompts.validation.ttsEngine', {
        n,
        defaultValue: 'Фраза {{n}}: выберите TTS-движок',
      });
    case 'tts_engine_not_found':
      return t('ivrs.prompts.validation.ttsEngineNotFound', {
        n,
        defaultValue: 'Фраза {{n}}: TTS-движок не найден',
      });
    case 'tts_params_missing':
      return t('ivrs.prompts.validation.ttsParams', {
        n,
        defaultValue: 'Фраза {{n}}: укажите голос (или настройте движок)',
      });
    default:
      return t('ivrs.prompts.validation.generic', {
        n,
        defaultValue: 'Фраза {{n}}: проверьте настройки',
      });
  }
}
