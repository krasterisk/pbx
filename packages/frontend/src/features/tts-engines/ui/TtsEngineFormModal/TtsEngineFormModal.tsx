import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import { Button, Input, VStack, HStack } from '@/shared/ui';
import { ITtsEngine } from '@/entities/engines';
import {
  useCreateTtsEngineMutation, useUpdateTtsEngineMutation,
} from '@/shared/api/endpoints/ttsEnginesApi';
import cls from './TtsEngineFormModal.module.scss';

interface TtsEngineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: ITtsEngine | null;
}

type EngineType = 'google' | 'yandex' | 'custom';
type AuthMode = 'none' | 'bearer' | 'custom';

export function TtsEngineFormModal({ isOpen, onClose, engine }: TtsEngineFormModalProps) {
  const { t } = useTranslation();
  const [createEngine] = useCreateTtsEngineMutation();
  const [updateEngine] = useUpdateTtsEngineMutation();

  const [name, setName] = useState('');
  const [type, setType] = useState<EngineType>('google');
  const [token, setToken] = useState('');

  // Google settings
  const [languageCode, setLanguageCode] = useState('ru-RU');
  const [voiceName, setVoiceName] = useState('ru-RU-Wavenet-A');
  const [speakingRate, setSpeakingRate] = useState('1.0');

  // Yandex settings
  const [folderId, setFolderId] = useState('');
  const [yandexVoice, setYandexVoice] = useState('alena');
  const [emotion, setEmotion] = useState('neutral');
  const [speed, setSpeed] = useState('1.0');

  // Custom settings
  const [customUrl, setCustomUrl] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);

  useEffect(() => {
    if (engine) {
      setName(engine.name || '');
      setType(engine.type || 'google');
      setToken(engine.token || '');
      setCustomUrl(engine.custom_url || '');
      setAuthMode(engine.auth_mode || 'none');

      const s = engine.settings || {};
      setLanguageCode(s.language_code || 'ru-RU');
      setVoiceName(s.voice_name || 'ru-RU-Wavenet-A');
      setSpeakingRate(s.speaking_rate || '1.0');
      setFolderId(s.folder_id || '');
      setYandexVoice(s.voice || 'alena');
      setEmotion(s.emotion || 'neutral');
      setSpeed(s.speed || '1.0');

      const hdrs = engine.custom_headers || {};
      setCustomHeaders(Object.entries(hdrs).map(([key, value]) => ({ key, value })));
    } else {
      setName('');
      setType('google');
      setToken('');
      setCustomUrl('');
      setAuthMode('none');
      setLanguageCode('ru-RU');
      setVoiceName('ru-RU-Wavenet-A');
      setSpeakingRate('1.0');
      setFolderId('');
      setYandexVoice('alena');
      setEmotion('neutral');
      setSpeed('1.0');
      setCustomHeaders([]);
    }
  }, [engine, isOpen]);

  const buildSettings = (): Record<string, any> => {
    switch (type) {
      case 'google':
        return { language_code: languageCode, voice_name: voiceName, speaking_rate: speakingRate };
      case 'yandex':
        return { folder_id: folderId, voice: yandexVoice, emotion, speed };
      case 'custom':
        return {};
      default:
        return {};
    }
  };

  const buildHeaders = (): Record<string, string> => {
    const result: Record<string, string> = {};
    customHeaders.forEach(h => {
      if (h.key.trim()) result[h.key.trim()] = h.value;
    });
    return result;
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const payload: Partial<ITtsEngine> = {
      name: name.trim(),
      type,
      token,
      settings: buildSettings(),
      custom_url: type === 'custom' ? customUrl : '',
      auth_mode: type === 'custom' ? authMode : 'none',
      custom_headers: type === 'custom' && authMode === 'custom' ? buildHeaders() : {},
    };

    try {
      if (engine) {
        await updateEngine({ uid: engine.uid, data: payload }).unwrap();
      } else {
        await createEngine(payload).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save TTS engine', err);
    }
  };

  const addHeader = () => setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  const removeHeader = (i: number) => setCustomHeaders(customHeaders.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) => {
    const copy = [...customHeaders];
    copy[i] = { ...copy[i], [field]: val };
    setCustomHeaders(copy);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {engine ? t('ttsEngines.edit', 'Редактировать движок') : t('ttsEngines.add', 'Добавить движок')}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16">
          {/* Name */}
          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.name', 'Название')}</label>
            <Input placeholder="Google Cloud TTS" value={name} onChange={e => setName(e.target.value)} />
          </VStack>

          {/* Type selector */}
          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.type', 'Тип')}</label>
            <div className={cls.typeSelector}>
              {(['google', 'yandex', 'custom'] as EngineType[]).map(tp => (
                <button
                  key={tp}
                  type="button"
                  className={`${cls.typeOption} ${type === tp ? cls.selected : ''}`}
                  onClick={() => setType(tp)}
                >
                  {tp === 'google' ? 'Google' : tp === 'yandex' ? 'Yandex' : 'Custom'}
                </button>
              ))}
            </div>
          </VStack>

          {/* Token (Google & Yandex) */}
          {type !== 'custom' && (
            <VStack gap="4">
              <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.token', 'API Key / Token')}</label>
              <Input
                type="password"
                placeholder="AIza..."
                value={token}
                onChange={e => setToken(e.target.value)}
              />
            </VStack>
          )}

          {/* Google-specific settings */}
          {type === 'google' && (
            <>
              <HStack gap="8">
                <VStack gap="4" style={{ flex: 1 }}>
                  <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.google.languageCode', 'Язык')}</label>
                  <Input value={languageCode} onChange={e => setLanguageCode(e.target.value)} placeholder="ru-RU" />
                </VStack>
                <VStack gap="4" style={{ flex: 1 }}>
                  <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.google.speakingRate', 'Скорость')}</label>
                  <Input value={speakingRate} onChange={e => setSpeakingRate(e.target.value)} placeholder="1.0" />
                </VStack>
              </HStack>
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.google.voiceName', 'Голос')}</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                  value={voiceName}
                  onChange={e => setVoiceName(e.target.value)}
                >
                  <option value="ru-RU-Wavenet-A">ru-RU-Wavenet-A (Женский)</option>
                  <option value="ru-RU-Wavenet-B">ru-RU-Wavenet-B (Мужской)</option>
                  <option value="ru-RU-Wavenet-C">ru-RU-Wavenet-C (Женский 2)</option>
                  <option value="ru-RU-Wavenet-D">ru-RU-Wavenet-D (Мужской 2)</option>
                  <option value="ru-RU-Standard-A">ru-RU-Standard-A (Женский)</option>
                  <option value="ru-RU-Standard-B">ru-RU-Standard-B (Мужской)</option>
                  <option value="en-US-Wavenet-A">en-US-Wavenet-A (Female)</option>
                  <option value="en-US-Wavenet-B">en-US-Wavenet-B (Male)</option>
                </select>
              </VStack>
            </>
          )}

          {/* Yandex-specific settings */}
          {type === 'yandex' && (
            <>
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.yandex.folderId', 'Folder ID')}</label>
                <Input value={folderId} onChange={e => setFolderId(e.target.value)} placeholder="b1g..." />
              </VStack>
              <HStack gap="8">
                <VStack gap="4" style={{ flex: 1 }}>
                  <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.yandex.voice', 'Голос')}</label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                    value={yandexVoice}
                    onChange={e => setYandexVoice(e.target.value)}
                  >
                    <option value="alena">{t('ttsEngines.yandex.voiceAlena', 'Алёна')}</option>
                    <option value="filipp">{t('ttsEngines.yandex.voiceFilipp', 'Филипп')}</option>
                    <option value="ermil">{t('ttsEngines.yandex.voiceErmil', 'Ермил')}</option>
                    <option value="jane">{t('ttsEngines.yandex.voiceJane', 'Джейн')}</option>
                  </select>
                </VStack>
                <VStack gap="4" style={{ flex: 1 }}>
                  <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.yandex.emotion', 'Эмоция')}</label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                    value={emotion}
                    onChange={e => setEmotion(e.target.value)}
                  >
                    <option value="neutral">{t('ttsEngines.yandex.emotionNeutral', 'Нейтральная')}</option>
                    <option value="good">{t('ttsEngines.yandex.emotionGood', 'Доброжелательная')}</option>
                    <option value="evil">{t('ttsEngines.yandex.emotionEvil', 'Раздражённая')}</option>
                  </select>
                </VStack>
              </HStack>
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.yandex.speed', 'Скорость')}</label>
                <Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="1.0" />
              </VStack>
            </>
          )}

          {/* Custom-specific settings */}
          {type === 'custom' && (
            <>
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.custom.url', 'URL эндпоинта')}</label>
                <Input
                  placeholder="https://api.example.com/tts/synthesize"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                />
              </VStack>

              {/* Auth mode selector */}
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.custom.authMode', 'Авторизация')}</label>
                <div className={cls.authSelector}>
                  {(['none', 'bearer', 'custom'] as AuthMode[]).map(am => (
                    <button
                      key={am}
                      type="button"
                      className={`${cls.authOption} ${authMode === am ? cls.selected : ''}`}
                      onClick={() => setAuthMode(am)}
                    >
                      {am === 'none'
                        ? t('ttsEngines.custom.authNone', 'Нет')
                        : am === 'bearer'
                          ? t('ttsEngines.custom.authBearer', 'Bearer Token')
                          : t('ttsEngines.custom.authCustom', 'Заголовки')}
                    </button>
                  ))}
                </div>
              </VStack>

              {authMode === 'bearer' && (
                <VStack gap="4">
                  <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.token', 'Bearer Token')}</label>
                  <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="eyJhbG..." />
                </VStack>
              )}

              {authMode === 'custom' && (
                <VStack gap="4">
                  <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.custom.headers', 'Заголовки')}</label>
                  <div className={cls.headersEditor}>
                    {customHeaders.map((header, i) => (
                      <div key={i} className={cls.headerRow}>
                        <input
                          className={cls.headerInput}
                          placeholder="Header Name"
                          value={header.key}
                          onChange={e => updateHeader(i, 'key', e.target.value)}
                        />
                        <input
                          className={cls.headerInput}
                          placeholder="Header Value"
                          value={header.value}
                          onChange={e => updateHeader(i, 'value', e.target.value)}
                        />
                        <button type="button" className={cls.removeHeaderBtn} onClick={() => removeHeader(i)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className={cls.addHeaderBtn} onClick={addHeader}>
                      <Plus size={14} />
                      {t('common.add', 'Добавить')}
                    </button>
                  </div>
                </VStack>
              )}
            </>
          )}
        </VStack>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Отмена')}</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
