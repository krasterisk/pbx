import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Volume2 } from 'lucide-react';
import { Input, Label, Select } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import type { AiCapability } from '@/shared/api/endpoints/aiAgentsApi';
import styles from './AiProviderModal.module.scss';

export type SpeechVendor = 'yandex' | 'google';

export interface SpeechFieldValues {
  voice: string;
  role: string;
  speed: string;
  pitchShift: string;
  languageCode: string;
  voiceName: string;
  speakingRate: string;
  model: string;
  eouSensitivity: string;
}

const YANDEX_VOICES = [
  ['alena', 'ttsEngines.yandex.voiceAlena', 'Алёна (Премиум)'],
  ['filipp', 'ttsEngines.yandex.voiceFilipp', 'Филипп (Премиум)'],
  ['ermil', 'ttsEngines.yandex.voiceErmil', 'Ермил (Стандарт)'],
  ['jane', 'ttsEngines.yandex.voiceJane', 'Джейн (Стандарт)'],
  ['zahar', 'ttsEngines.yandex.voiceZahar', 'Захар (Стандарт)'],
  ['omazh', 'ttsEngines.yandex.voiceOmazh', 'Омаж (Стандарт)'],
  ['marina', 'ttsEngines.yandex.voiceMarina', 'Марина (Стандарт)'],
  ['dasha', 'ttsEngines.yandex.voiceDasha', 'Даша (Стандарт)'],
  ['julia', 'ttsEngines.yandex.voiceJulia', 'Юля (Стандарт)'],
  ['lera', 'ttsEngines.yandex.voiceLera', 'Лера (Стандарт)'],
  ['masha', 'ttsEngines.yandex.voiceMasha', 'Маша (Стандарт)'],
  ['alexander', 'ttsEngines.yandex.voiceAlexander', 'Александр (Стандарт)'],
  ['kirill', 'ttsEngines.yandex.voiceKirill', 'Кирилл (Стандарт)'],
  ['anton', 'ttsEngines.yandex.voiceAnton', 'Антон (Стандарт)'],
  ['madirus', 'ttsEngines.yandex.voiceMadirus', 'Мадирус (Амплуа)'],
  ['madi_ru', 'ttsEngines.yandex.voiceMadiRu', 'Мади (Амплуа)'],
  ['saule_ru', 'ttsEngines.yandex.voiceSauleRu', 'Сауле (Амплуа)'],
  ['zamira_ru', 'ttsEngines.yandex.voiceZamiraRu', 'Замира (Амплуа)'],
  ['zhanar_ru', 'ttsEngines.yandex.voiceZhanarRu', 'Жанар (Амплуа)'],
  ['yulduz_ru', 'ttsEngines.yandex.voiceYulduzRu', 'Юлдуз (Амплуа)'],
] as const;

const YANDEX_ROLE_LABELS: Record<string, [string, string]> = {
  neutral: ['ttsEngines.yandex.emotionNeutral', 'Нейтральная'],
  good: ['ttsEngines.yandex.emotionGood', 'Доброжелательная'],
  evil: ['ttsEngines.yandex.emotionEvil', 'Злая/Раздражённая'],
  strict: ['ttsEngines.yandex.emotionStrict', 'Строгая'],
  friendly: ['ttsEngines.yandex.emotionFriendly', 'Дружелюбная'],
  whisper: ['ttsEngines.yandex.emotionWhisper', 'Шёпот'],
};

/** Roles from the SpeechKit voice list. An empty list means the voice rejects any role. */
const YANDEX_VOICE_ROLES: Record<string, readonly string[]> = {
  alena: ['neutral', 'good'],
  filipp: [],
  ermil: ['neutral', 'good'],
  jane: ['neutral', 'good', 'evil'],
  omazh: ['neutral', 'evil'],
  zahar: ['neutral', 'good'],
  dasha: ['neutral', 'good', 'friendly'],
  julia: ['neutral', 'strict'],
  lera: ['neutral', 'friendly'],
  masha: ['good', 'strict', 'friendly'],
  marina: ['neutral', 'whisper', 'friendly'],
  alexander: ['neutral', 'good'],
  kirill: ['neutral', 'strict', 'good'],
  anton: ['neutral', 'good'],
  madirus: [],
  madi_ru: [],
  saule_ru: ['neutral', 'strict', 'whisper'],
  zamira_ru: ['neutral', 'strict', 'friendly'],
  zhanar_ru: ['neutral', 'strict', 'friendly'],
  yulduz_ru: ['neutral', 'strict', 'friendly', 'whisper'],
};

export function yandexRoles(voice: string): readonly string[] {
  return YANDEX_VOICE_ROLES[voice] ?? [];
}

export function yandexRole(voice: string, role: string): string {
  const roles = yandexRoles(voice);
  if (!roles.length) return '';
  return roles.includes(role) ? role : roles[0];
}

const GOOGLE_VOICES = [
  ['ru-RU-Wavenet-A', 'Женский'],
  ['ru-RU-Wavenet-B', 'Мужской'],
  ['ru-RU-Wavenet-C', 'Женский 2'],
  ['ru-RU-Wavenet-D', 'Мужской 2'],
  ['ru-RU-Standard-A', 'Женский'],
  ['ru-RU-Standard-B', 'Мужской'],
  ['en-US-Wavenet-A', 'Female'],
  ['en-US-Wavenet-B', 'Male'],
] as const;

const GOOGLE_STT_LANGUAGES = [
  ['ru-RU', 'Русский (ru-RU)'],
  ['en-US', 'English (en-US)'],
  ['es-ES', 'Español (es-ES)'],
  ['fr-FR', 'Français (fr-FR)'],
  ['de-DE', 'Deutsch (de-DE)'],
] as const;

const YANDEX_STT_LANGUAGES = [
  ['auto', 'Автоопределение (auto)'],
  ['ru-RU', 'Русский (ru-RU)'],
  ['en-US', 'English (en-US)'],
  ['kk-KZ', 'Казахский (kk-KZ)'],
  ['uz-UZ', 'Узбекский (uz-UZ)'],
  ['de-DE', 'Немецкий (de-DE)'],
  ['es-ES', 'Испанский (es-ES)'],
  ['fi-FI', 'Финский (fi-FI)'],
  ['fr-FR', 'Французский (fr-FR)'],
  ['he-IL', 'Иврит (he-IL)'],
  ['it-IT', 'Итальянский (it-IT)'],
  ['nl-NL', 'Нидерландский (nl-NL)'],
  ['pl-PL', 'Польский (pl-PL)'],
  ['pt-PT', 'Португальский (pt-PT)'],
  ['pt-BR', 'Португальский (Бразилия) (pt-BR)'],
  ['sv-SE', 'Шведский (sv-SE)'],
  ['tr-TR', 'Турецкий (tr-TR)'],
] as const;

const SPEECH_DEFAULT_KEYS = [
  'voice', 'role', 'emotion', 'speed', 'pitch_shift',
  'language_code', 'voice_name', 'speaking_rate', 'eou_sensitivity',
] as const;

export function isSpeechVendor(vendor: string): vendor is SpeechVendor {
  return vendor === 'yandex' || vendor === 'google';
}

export function speechFieldsFromDefaults(
  defaults: Record<string, unknown> | undefined,
  mode: 'preset' | 'plain' = 'preset',
): SpeechFieldValues {
  const text = (key: string, fallback = '') => {
    const value = defaults?.[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  };
  const preset = mode === 'preset';
  return {
    voice: text('voice', preset ? 'alena' : ''),
    role: text('role') || text('emotion', preset ? 'neutral' : ''),
    speed: text('speed', preset ? '1.0' : ''),
    pitchShift: text('pitch_shift', preset ? '0' : ''),
    languageCode: text('language_code', preset ? 'ru-RU' : ''),
    voiceName: text('voice_name', preset ? 'ru-RU-Wavenet-A' : ''),
    speakingRate: text('speaking_rate', preset ? '1.0' : ''),
    model: text('model', preset ? 'general' : ''),
    eouSensitivity: text('eou_sensitivity', preset ? 'DEFAULT' : ''),
  };
}

export function clearedSpeechDefaults(): Record<string, string> {
  return Object.fromEntries(SPEECH_DEFAULT_KEYS.map((key) => [key, '']));
}

export function speechDefaultsFromFields(
  vendor: string,
  caps: AiCapability[],
  fields: SpeechFieldValues,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (vendor === 'yandex' && caps.includes('tts')) {
    const role = yandexRole(fields.voice, fields.role);
    out.voice = fields.voice;
    out.role = role;
    out.emotion = role;
    out.speed = fields.speed;
    out.pitch_shift = fields.pitchShift;
  }
  if (vendor === 'google' && caps.includes('tts')) {
    out.language_code = fields.languageCode;
    out.voice_name = fields.voiceName;
    out.speaking_rate = fields.speakingRate;
  }
  if ((vendor === 'yandex' || vendor === 'google') && caps.includes('stt')) {
    out.language_code = fields.languageCode;
    out.model = fields.model;
    if (vendor === 'yandex') {
      out.eou_sensitivity = fields.eouSensitivity;
    }
  }
  if (vendor !== 'yandex' && vendor !== 'google') {
    if (caps.includes('tts')) {
      out.voice = fields.voice;
      out.speed = fields.speed;
    }
    if (caps.includes('tts') || caps.includes('stt')) {
      out.language_code = fields.languageCode;
      out.model = fields.model;
    }
  }
  return out;
}

const HOSTED_SPEECH_ENDPOINTS = new Set([
  'https://tts.api.cloud.yandex.net',
  'https://stt.api.cloud.yandex.net',
  'https://texttospeech.googleapis.com',
  'https://speech.googleapis.com',
]);

export function isHostedSpeechEndpoint(url: string): boolean {
  return HOSTED_SPEECH_ENDPOINTS.has(url.trim().replace(/\/+$/, ''));
}

export function hostedSpeechEndpoint(vendor: string, caps: AiCapability[]): string {
  if (vendor === 'yandex' && caps.includes('tts')) return 'https://tts.api.cloud.yandex.net';
  if (vendor === 'yandex' && caps.includes('stt')) return 'https://stt.api.cloud.yandex.net';
  if (vendor === 'google' && caps.includes('tts')) return 'https://texttospeech.googleapis.com';
  if (vendor === 'google' && caps.includes('stt')) return 'https://speech.googleapis.com';
  return '';
}

export interface SpeechPreviewControl {
  disabled: boolean;
  busy: boolean;
  hint: string;
  label: string;
  onPreview: () => void;
}

interface Props {
  vendor: string;
  caps: AiCapability[];
  fields: SpeechFieldValues;
  custom?: boolean;
  onChange: (key: keyof SpeechFieldValues, value: string) => void;
  preview?: SpeechPreviewControl;
}

function VoicePreviewButton({ preview, inset }: { preview?: SpeechPreviewControl; inset?: boolean }) {
  if (!preview) return null;
  return (
    <button
      type="button"
      className={inset ? styles.voiceListen : styles.voiceListenInline}
      disabled={preview.disabled || preview.busy}
      title={preview.disabled ? preview.hint : preview.label}
      aria-label={preview.label}
      onClick={preview.onPreview}
    >
      {preview.busy ? <Loader2 className={styles.spin} /> : <Volume2 size={16} />}
    </button>
  );
}

export function SpeechCatalogFields({ vendor, caps, fields, custom, onChange, preview }: Props) {
  const { t } = useTranslation();
  const yandexTts = !custom && vendor === 'yandex' && caps.includes('tts');
  const voiceRoles = yandexTts ? yandexRoles(fields.voice) : [];
  useEffect(() => {
    if (!yandexTts) return;
    const next = yandexRole(fields.voice, fields.role);
    if (next !== fields.role) onChange('role', next);
  }, [yandexTts, fields.voice, fields.role, onChange]);
  const googleTts = !custom && vendor === 'google' && caps.includes('tts');
  const yandexStt = !custom && vendor === 'yandex' && caps.includes('stt');
  const googleStt = !custom && vendor === 'google' && caps.includes('stt');
  const customSpeech = Boolean(custom) && (caps.includes('tts') || caps.includes('stt'));
  if (!yandexTts && !googleTts && !yandexStt && !googleStt && !customSpeech) return null;

  return (
    <VStack gap="16" max>
      {yandexTts && (
        <>
          <HStack gap="16" className={styles.row} max>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-voice" className={styles.fieldLabel}>
                {t('ttsEngines.yandex.voice', 'Голос')}
              </Label>
              <div className={styles.voiceControl}>
                <Select
                  id="ai-speech-voice"
                  className={styles.voiceSelect}
                  value={fields.voice}
                  onChange={(event) => onChange('voice', event.target.value)}
                >
                  {YANDEX_VOICES.map(([value, key, fallback]) => (
                    <option key={value} value={value}>{t(key, fallback)}</option>
                  ))}
                </Select>
                <VoicePreviewButton preview={preview} inset />
              </div>
            </VStack>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-role" className={styles.fieldLabel}>
                {t('ttsEngines.yandex.role', 'Амплуа/Стиль')}
              </Label>
              <Select
                id="ai-speech-role"
                value={fields.role}
                disabled={voiceRoles.length === 0}
                onChange={(event) => onChange('role', event.target.value)}
              >
                {voiceRoles.length === 0 && <option value="">{t('ttsEngines.yandex.roleNone', 'Без амплуа')}</option>}
                {voiceRoles.map((value) => {
                  const [key, fallback] = YANDEX_ROLE_LABELS[value];
                  return <option key={value} value={value}>{t(key, fallback)}</option>;
                })}
              </Select>
            </VStack>
          </HStack>
          <HStack gap="16" className={styles.row} max>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-speed" className={styles.fieldLabel}>
                {t('ttsEngines.yandex.speed', 'Скорость (0.1 - 3.0)')}
              </Label>
              <Input
                id="ai-speech-speed"
                type="number"
                step="0.1"
                min="0.1"
                max="3"
                value={fields.speed}
                onChange={(event) => onChange('speed', event.target.value)}
              />
            </VStack>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-pitch" className={styles.fieldLabel}>
                {t('ttsEngines.yandex.pitchShift', 'Сдвиг тона (-1000 - 1000 Hz)')}
              </Label>
              <Input
                id="ai-speech-pitch"
                type="number"
                step="10"
                min="-1000"
                max="1000"
                value={fields.pitchShift}
                onChange={(event) => onChange('pitchShift', event.target.value)}
              />
            </VStack>
          </HStack>
        </>
      )}

      {yandexStt && (
        <>
          <HStack gap="16" className={styles.row} max>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-lang" className={styles.fieldLabel}>
                {t('sttEngines.yandex.languageCode', 'Язык')}
              </Label>
              <Select
                id="ai-speech-lang"
                value={fields.languageCode}
                onChange={(event) => onChange('languageCode', event.target.value)}
              >
                {YANDEX_STT_LANGUAGES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </VStack>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-model" className={styles.fieldLabel}>
                {t('sttEngines.yandex.model', 'Модель')}
              </Label>
              <Select
                id="ai-speech-model"
                value={fields.model}
                onChange={(event) => onChange('model', event.target.value)}
              >
                <option value="general">{t('sttEngines.yandex.modelGeneral', 'General (Основная)')}</option>
                <option value="general:rc">{t('sttEngines.yandex.modelGeneralRc', 'General RC')}</option>
              </Select>
            </VStack>
          </HStack>
          <VStack gap="8" max className={styles.field}>
            <Label htmlFor="ai-speech-eou" className={styles.fieldLabel}>
              {t('sttEngines.yandex.eouSensitivity', 'EOU Чувствительность')}
            </Label>
            <Select
              id="ai-speech-eou"
              value={fields.eouSensitivity}
              onChange={(event) => onChange('eouSensitivity', event.target.value)}
            >
              <option value="DEFAULT">{t('sttEngines.yandex.eouDefault', 'Стандартная')}</option>
              <option value="HIGH">{t('sttEngines.yandex.eouHigh', 'Высокая (быстрая)')}</option>
            </Select>
          </VStack>
        </>
      )}

      {googleTts && (
        <>
          <HStack gap="16" className={styles.row} max>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-glang" className={styles.fieldLabel}>
                {t('ttsEngines.google.languageCode', 'Язык')}
              </Label>
              <Input
                id="ai-speech-glang"
                value={fields.languageCode}
                placeholder="ru-RU"
                onChange={(event) => onChange('languageCode', event.target.value)}
              />
            </VStack>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-grate" className={styles.fieldLabel}>
                {t('ttsEngines.google.speakingRate', 'Скорость')}
              </Label>
              <Input
                id="ai-speech-grate"
                value={fields.speakingRate}
                placeholder="1.0"
                onChange={(event) => onChange('speakingRate', event.target.value)}
              />
            </VStack>
          </HStack>
          <VStack gap="8" max className={styles.field}>
            <Label htmlFor="ai-speech-gvoice" className={styles.fieldLabel}>
              {t('ttsEngines.google.voiceName', 'Голос')}
            </Label>
            <div className={styles.voiceControl}>
              <Select
                id="ai-speech-gvoice"
                className={styles.voiceSelect}
                value={fields.voiceName}
                onChange={(event) => onChange('voiceName', event.target.value)}
              >
                {GOOGLE_VOICES.map(([value, label]) => (
                  <option key={value} value={value}>{value} ({label})</option>
                ))}
              </Select>
              <VoicePreviewButton preview={preview} inset />
            </div>
          </VStack>
        </>
      )}

      {customSpeech && (
        <>
          {caps.includes('tts') && (
            <HStack gap="16" className={styles.row} max>
              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="ai-speech-custom-voice" className={styles.fieldLabel}>
                  {t('ttsEngines.yandex.voice', 'Голос')}
                </Label>
                <div className={styles.voiceControl}>
                  <Input
                    id="ai-speech-custom-voice"
                    className={styles.voiceSelect}
                    value={fields.voice}
                    onChange={(event) => onChange('voice', event.target.value)}
                  />
                  <VoicePreviewButton preview={preview} inset />
                </div>
              </VStack>
              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="ai-speech-custom-speed" className={styles.fieldLabel}>
                  {t('ttsEngines.google.speakingRate', 'Скорость')}
                </Label>
                <Input
                  id="ai-speech-custom-speed"
                  value={fields.speed}
                  placeholder="1.0"
                  onChange={(event) => onChange('speed', event.target.value)}
                />
              </VStack>
            </HStack>
          )}
          <HStack gap="16" className={styles.row} max>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-custom-lang" className={styles.fieldLabel}>
                {t('ttsEngines.google.languageCode', 'Язык')}
              </Label>
              <Input
                id="ai-speech-custom-lang"
                value={fields.languageCode}
                placeholder="ru-RU"
                onChange={(event) => onChange('languageCode', event.target.value)}
              />
            </VStack>
            <VStack gap="8" max className={styles.field}>
              <Label htmlFor="ai-speech-custom-model" className={styles.fieldLabel}>
                {t('aiProviders.field.model', 'Модель')}
              </Label>
              <Input
                id="ai-speech-custom-model"
                value={fields.model}
                onChange={(event) => onChange('model', event.target.value)}
              />
            </VStack>
          </HStack>
        </>
      )}

      {googleStt && (
        <HStack gap="16" className={styles.row} max>
          <VStack gap="8" max className={styles.field}>
            <Label htmlFor="ai-speech-gstt-lang" className={styles.fieldLabel}>
              {t('sttEngines.google.languageCode', 'Язык')}
            </Label>
            <Select
              id="ai-speech-gstt-lang"
              value={fields.languageCode}
              onChange={(event) => onChange('languageCode', event.target.value)}
            >
              {GOOGLE_STT_LANGUAGES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </VStack>
          <VStack gap="8" max className={styles.field}>
            <Label htmlFor="ai-speech-gstt-model" className={styles.fieldLabel}>
              {t('sttEngines.google.model', 'Модель')}
            </Label>
            <Select
              id="ai-speech-gstt-model"
              value={fields.model}
              onChange={(event) => onChange('model', event.target.value)}
            >
              <option value="general">General</option>
              <option value="phone_call">Phone Call</option>
              <option value="command_and_search">Command & Search</option>
            </Select>
          </VStack>
        </HStack>
      )}
    </VStack>
  );
}
