import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/Dialog';
import { Button, Input, VStack, HStack, Label, Text, Select } from '@/shared/ui';
import { ITtsEngine } from '@/entities/engines';
import { useCreateTtsEngineMutation, useUpdateTtsEngineMutation } from '@/shared/api/endpoints/ttsEnginesApi';
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
  const [createEngine, { isLoading: isCreating }] = useCreateTtsEngineMutation();
  const [updateEngine, { isLoading: isUpdating }] = useUpdateTtsEngineMutation();

  const [name, setName] = useState('');
  const [type, setType] = useState<EngineType>('google');
  const [token, setToken] = useState('');

  // Google settings
  const [languageCode, setLanguageCode] = useState('ru-RU');
  const [voiceName, setVoiceName] = useState('ru-RU-Wavenet-A');
  const [speakingRate, setSpeakingRate] = useState('1.0');

  // Yandex settings
  const [yandexVoice, setYandexVoice] = useState('alena');
  const [emotion, setEmotion] = useState('neutral');
  const [speed, setSpeed] = useState('1.0');
  const [folderId, setFolderId] = useState('');
  const [pitchShift, setPitchShift] = useState('0');

  // Custom settings
  const [customUrl, setCustomUrl] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);

  useEffect(() => {
    if (engine) {
      setName(engine.name || '');
      setType((engine.type as EngineType) || 'google');
      setToken(engine.token || '');
      setCustomUrl(engine.custom_url || '');
      setAuthMode((engine.auth_mode as AuthMode) || 'none');

      const s = engine.settings || {};
      setLanguageCode(s.language_code || 'ru-RU');
      setVoiceName(s.voice_name || 'ru-RU-Wavenet-A');
      setSpeakingRate(s.speaking_rate || '1.0');
      
      setYandexVoice(s.voice || 'alena');
      setEmotion(s.emotion || s.role || 'neutral');
      setSpeed(s.speed || '1.0');
      setFolderId(s.folder_id || '');
      setPitchShift(s.pitch_shift || '0');

      const hdrs = engine.custom_headers || {};
      setCustomHeaders(Object.entries(hdrs).map(([key, value]) => ({ key, value: value as string })));
    } else {
      resetForm();
    }
  }, [engine, isOpen]);

  const resetForm = () => {
    setName('');
    setType('google');
    setToken('');
    setCustomUrl('');
    setAuthMode('none');
    setLanguageCode('ru-RU');
    setVoiceName('ru-RU-Wavenet-A');
    setSpeakingRate('1.0');
    setYandexVoice('alena');
    setEmotion('neutral');
    setSpeed('1.0');
    setFolderId('');
    setPitchShift('0');
    setCustomHeaders([]);
  };

  const buildSettings = (): Record<string, any> => {
    switch (type) {
      case 'google':
        return { language_code: languageCode, voice_name: voiceName, speaking_rate: speakingRate };
      case 'yandex':
        return {
          voice: yandexVoice,
          role: emotion,
          speed,
          folder_id: folderId,
          pitch_shift: pitchShift !== '0' ? pitchShift : undefined,
        };
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
        await createEngine(payload as any).unwrap();
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
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>
            {engine ? t('ttsEngines.edit', 'Редактировать движок') : t('ttsEngines.add', 'Добавить движок')}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16" className="py-4">
          <VStack gap="4">
            <Label>{t('ttsEngines.name', 'Название')}</Label>
            <Input placeholder={t('ttsEngines.namePlaceholder', 'Yandex Cloud TTS')} value={name} onChange={e => setName(e.target.value)} />
          </VStack>

          <VStack gap="4">
            <Label>{t('ttsEngines.type', 'Тип')}</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as EngineType)}>
              <option value="google">{t('ttsEngines.typeGoogle', 'Google Speech-to-Text / TTS')}</option>
              <option value="yandex">{t('ttsEngines.typeYandex', 'Yandex SpeechKit')}</option>
              <option value="custom">{t('ttsEngines.typeCustom', 'Custom Endpoint')}</option>
            </Select>
          </VStack>

          {type !== 'custom' && (
            <VStack gap="4">
              <Label>{t('ttsEngines.token', 'API Key / Token')}</Label>
              <Input
                type="password"
                placeholder={type === 'yandex' ? t('ttsEngines.tokenPlaceholderYandex', 'Api-Key ... или Bearer ...') : 'AIza...'}
                value={token}
                onChange={e => setToken(e.target.value)}
              />
            </VStack>
          )}

          {type === 'google' && (
            <>
              <HStack gap="8">
                <VStack gap="4" className="flex-1">
                  <Label>{t('ttsEngines.google.languageCode', 'Язык')}</Label>
                  <Input value={languageCode} onChange={e => setLanguageCode(e.target.value)} placeholder="ru-RU" />
                </VStack>
                <VStack gap="4" className="flex-1">
                  <Label>{t('ttsEngines.google.speakingRate', 'Скорость')}</Label>
                  <Input value={speakingRate} onChange={e => setSpeakingRate(e.target.value)} placeholder="1.0" />
                </VStack>
              </HStack>
              <VStack gap="4">
                <Label>{t('ttsEngines.google.voiceName', 'Голос')}</Label>
                <Select
                  value={voiceName}
                  onChange={e => setVoiceName(e.target.value)}
                >
                  <option value="ru-RU-Wavenet-A">ru-RU-Wavenet-A ({t('ttsEngines.voiceFemale', 'Женский')})</option>
                  <option value="ru-RU-Wavenet-B">ru-RU-Wavenet-B ({t('ttsEngines.voiceMale', 'Мужской')})</option>
                  <option value="ru-RU-Wavenet-C">ru-RU-Wavenet-C ({t('ttsEngines.voiceFemale', 'Женский')} 2)</option>
                  <option value="ru-RU-Wavenet-D">ru-RU-Wavenet-D ({t('ttsEngines.voiceMale', 'Мужской')} 2)</option>
                  <option value="ru-RU-Standard-A">ru-RU-Standard-A ({t('ttsEngines.voiceFemale', 'Женский')})</option>
                  <option value="ru-RU-Standard-B">ru-RU-Standard-B ({t('ttsEngines.voiceMale', 'Мужской')})</option>
                  <option value="en-US-Wavenet-A">en-US-Wavenet-A (Female)</option>
                  <option value="en-US-Wavenet-B">en-US-Wavenet-B (Male)</option>
                </Select>
              </VStack>
            </>
          )}

          {type === 'yandex' && (
            <>
              <VStack gap="4">
                <Label>{t('ttsEngines.yandex.folderId', 'Folder ID')}</Label>
                <Input
                  placeholder="b1g..."
                  value={folderId}
                  onChange={e => setFolderId(e.target.value)}
                />
              </VStack>
              <HStack gap="8">
                <VStack gap="4" className="flex-1">
                  <Label>{t('ttsEngines.yandex.voice', 'Голос')}</Label>
                  <Select
                    value={yandexVoice}
                    onChange={e => setYandexVoice(e.target.value)}
                  >
                    <option value="alena">{t('ttsEngines.yandex.voiceAlena', 'Алёна (Премиум)')}</option>
                    <option value="filipp">{t('ttsEngines.yandex.voiceFilipp', 'Филипп (Премиум)')}</option>
                    <option value="ermil">{t('ttsEngines.yandex.voiceErmil', 'Ермил (Стандарт)')}</option>
                    <option value="jane">{t('ttsEngines.yandex.voiceJane', 'Джейн (Стандарт)')}</option>
                    <option value="zahar">{t('ttsEngines.yandex.voiceZahar', 'Захар (Стандарт)')}</option>
                    <option value="omazh">{t('ttsEngines.yandex.voiceOmazh', 'Омаж (Стандарт)')}</option>
                    <option value="marina">{t('ttsEngines.yandex.voiceMarina', 'Марина (Стандарт)')}</option>
                    <option value="dasha">{t('ttsEngines.yandex.voiceDasha', 'Даша (Стандарт)')}</option>
                    <option value="julia">{t('ttsEngines.yandex.voiceJulia', 'Юля (Стандарт)')}</option>
                    <option value="lera">{t('ttsEngines.yandex.voiceLera', 'Лера (Стандарт)')}</option>
                    <option value="masha">{t('ttsEngines.yandex.voiceMasha', 'Маша (Стандарт)')}</option>
                    <option value="alexander">{t('ttsEngines.yandex.voiceAlexander', 'Александр (Стандарт)')}</option>
                    <option value="kirill">{t('ttsEngines.yandex.voiceKirill', 'Кирилл (Стандарт)')}</option>
                    <option value="anton">{t('ttsEngines.yandex.voiceAnton', 'Антон (Стандарт)')}</option>
                    <option value="madirus">{t('ttsEngines.yandex.voiceMadirus', 'Мадирус (Амплуа)')}</option>
                    <option value="madi_ru">{t('ttsEngines.yandex.voiceMadiRu', 'Мади (Амплуа)')}</option>
                    <option value="saule_ru">{t('ttsEngines.yandex.voiceSauleRu', 'Сауле (Амплуа)')}</option>
                    <option value="zamira_ru">{t('ttsEngines.yandex.voiceZamiraRu', 'Замира (Амплуа)')}</option>
                    <option value="zhanar_ru">{t('ttsEngines.yandex.voiceZhanarRu', 'Жанар (Амплуа)')}</option>
                    <option value="yulduz_ru">{t('ttsEngines.yandex.voiceYulduzRu', 'Юлдуз (Амплуа)')}</option>
                  </Select>
                </VStack>
                <VStack gap="4" className="flex-1">
                  <Label>{t('ttsEngines.yandex.role', 'Амплуа/Стиль')}</Label>
                  <Select
                    value={emotion}
                    onChange={e => setEmotion(e.target.value)}
                  >
                    <option value="neutral">{t('ttsEngines.yandex.emotionNeutral', 'Нейтральная')}</option>
                    <option value="good">{t('ttsEngines.yandex.emotionGood', 'Доброжелательная')}</option>
                    <option value="evil">{t('ttsEngines.yandex.emotionEvil', 'Злая/Раздражённая')}</option>
                    <option value="strict">{t('ttsEngines.yandex.emotionStrict', 'Строгая')}</option>
                    <option value="friendly">{t('ttsEngines.yandex.emotionFriendly', 'Дружелюбная')}</option>
                  </Select>
                </VStack>
              </HStack>
              <HStack gap="8">
                <VStack gap="4" className="flex-1">
                  <Label>{t('ttsEngines.yandex.speed', 'Скорость (0.1 — 3.0)')}</Label>
                  <Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="1.0" type="number" step="0.1" min="0.1" max="3.0" />
                </VStack>
                <VStack gap="4" className="flex-1">
                  <Label>{t('ttsEngines.yandex.pitchShift', 'Сдвиг тона (-1000 — 1000 Hz)')}</Label>
                  <Input value={pitchShift} onChange={e => setPitchShift(e.target.value)} placeholder="0" type="number" step="10" min="-1000" max="1000" />
                </VStack>
              </HStack>
            </>
          )}

          {type === 'custom' && (
            <>
              <VStack gap="4">
                <Label>{t('ttsEngines.custom.url', 'URL эндпоинта')}</Label>
                <Input
                  placeholder="https://api.example.com/tts/synthesize"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                />
              </VStack>

              <VStack gap="4">
                <Label>{t('ttsEngines.custom.authMode', 'Авторизация')}</Label>
                <Select value={authMode} onChange={(e) => setAuthMode(e.target.value as AuthMode)}>
                  <option value="none">{t('ttsEngines.custom.authNone', 'Нет')}</option>
                  <option value="bearer">{t('ttsEngines.custom.authBearer', 'Bearer Token')}</option>
                  <option value="custom">{t('ttsEngines.custom.authCustom', 'Пользовательские заголовки')}</option>
                </Select>
              </VStack>

              {authMode === 'bearer' && (
                <VStack gap="4">
                  <Label>{t('ttsEngines.token', 'Bearer Token')}</Label>
                  <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="eyJhbG..." />
                </VStack>
              )}

              {authMode === 'custom' && (
                <VStack gap="4">
                  <Label>{t('ttsEngines.custom.headers', 'Заголовки')}</Label>
                  <VStack gap="8" className="bg-background rounded-lg border border-border p-4">
                    {customHeaders.map((header, i) => (
                      <HStack gap="8" key={i} align="center">
                        <Input
                          placeholder={t('ttsEngines.custom.headerName', 'Имя заголовка')}
                          value={header.key}
                          onChange={e => updateHeader(i, 'key', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder={t('ttsEngines.custom.headerValue', 'Значение')}
                          value={header.value}
                          onChange={e => updateHeader(i, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => removeHeader(i)}>
                          <Trash2 size={16} className="w-4 h-4" />
                        </Button>
                      </HStack>
                    ))}
                    <Button variant="outline" size="sm" onClick={addHeader} className="w-fit mt-2">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('common.add', 'Добавить')}
                    </Button>
                  </VStack>
                </VStack>
              )}
            </>
          )}
        </VStack>

        <DialogFooter className="mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Отмена')}</Button>
          <Button onClick={handleSubmit} disabled={isCreating || isUpdating || !name.trim()}>
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

TtsEngineFormModal.displayName = 'TtsEngineFormModal';
