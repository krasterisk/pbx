import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/Dialog';
import { Button, Input, VStack, HStack, WebhookAuthConfig, type AuthMode, Label, Select } from '@/shared/ui';
import { ISttEngine } from '@/entities/engines';
import {
  useCreateSttEngineMutation, useUpdateSttEngineMutation,
} from '@/shared/api/endpoints/sttEnginesApi';

interface SttEngineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: ISttEngine | null;
}

type EngineType = 'google' | 'yandex' | 'custom';

export function SttEngineFormModal({ isOpen, onClose, engine }: SttEngineFormModalProps) {
  const { t } = useTranslation();
  const [createEngine, { isLoading: isCreating }] = useCreateSttEngineMutation();
  const [updateEngine, { isLoading: isUpdating }] = useUpdateSttEngineMutation();

  const [name, setName] = useState('');
  const [type, setType] = useState<EngineType>('google');
  const [token, setToken] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);

  // Google/Yandex settings
  const [languageCode, setLanguageCode] = useState('ru-RU');
  const [model, setModel] = useState('general');
  // Yandex-specific settings
  const [folderId, setFolderId] = useState('');
  const [eouSensitivity, setEouSensitivity] = useState('DEFAULT');

  useEffect(() => {
    if (engine) {
      setName(engine.name || '');
      setType((engine.type as EngineType) || 'google');
      setToken(engine.token || '');
      setCustomUrl(engine.custom_url || '');
      setAuthMode((engine.auth_mode as AuthMode) || 'none');
      const s = engine.settings || {};
      setLanguageCode(s.language_code || 'ru-RU');
      setModel(s.model || 'general');
      setFolderId(s.folder_id || '');
      setEouSensitivity(s.eou_sensitivity || 'DEFAULT');
      const hdrs = engine.custom_headers || {};
      setCustomHeaders(Object.entries(hdrs).map(([key, value]) => ({ key, value: String(value) })));
    } else {
      setName(''); setType('google'); setToken(''); setCustomUrl('');
      setAuthMode('none'); setLanguageCode('ru-RU'); setModel('general');
      setFolderId(''); setEouSensitivity('DEFAULT');
      setCustomHeaders([]);
    }
  }, [engine, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const settings: Record<string, any> = {};
    if (type === 'google') { settings.language_code = languageCode; settings.model = model; }
    if (type === 'yandex') {
      settings.language_code = languageCode;
      settings.model = model;
      settings.folder_id = folderId;
      settings.eou_sensitivity = eouSensitivity;
    }

    const hdrs: Record<string, string> = {};
    customHeaders.forEach(h => { if (h.key.trim()) hdrs[h.key.trim()] = h.value; });

    const payload: Partial<ISttEngine> = {
      name: name.trim(), type, token, settings,
      custom_url: type === 'custom' ? customUrl : '',
      auth_mode: type === 'custom' ? authMode : 'none',
      custom_headers: type === 'custom' && authMode === 'custom' ? hdrs : {},
    };

    try {
      if (engine) { await updateEngine({ uid: engine.uid, data: payload }).unwrap(); }
      else { await createEngine(payload as any).unwrap(); }
      onClose();
    } catch (err) { console.error('Failed to save STT engine', err); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>
            {engine ? t('sttEngines.edit', 'Редактировать движок') : t('sttEngines.add', 'Добавить движок')}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16" className="py-4">
          <VStack gap="4">
            <Label>{t('sttEngines.name', 'Название')}</Label>
            <Input placeholder={t('sttEngines.namePlaceholder', 'Google ASR')} value={name} onChange={e => setName(e.target.value)} />
          </VStack>

          {/* Type selector */}
          <VStack gap="4">
            <Label>{t('sttEngines.type', 'Тип')}</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as EngineType)}>
              <option value="google">{t('sttEngines.typeGoogle', 'Google Speech-to-Text')}</option>
              <option value="yandex">{t('sttEngines.typeYandex', 'Yandex SpeechKit')}</option>
              <option value="custom">{t('sttEngines.typeCustom', 'Custom API')}</option>
            </Select>
          </VStack>

          {type !== 'custom' && (
            <VStack gap="4">
              <Label>{t('sttEngines.token', 'API Key / Token')}</Label>
              <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="AIza..." />
            </VStack>
          )}

          {type === 'google' && (
            <HStack gap="8">
              <VStack gap="4" className="flex-1">
                <Label>{t('sttEngines.google.languageCode', 'Язык')}</Label>
                <Select value={languageCode} onChange={e => setLanguageCode(e.target.value)}>
                  <option value="ru-RU">Русский (ru-RU)</option>
                  <option value="en-US">English (en-US)</option>
                  <option value="es-ES">Español (es-ES)</option>
                  <option value="fr-FR">Français (fr-FR)</option>
                  <option value="de-DE">Deutsch (de-DE)</option>
                </Select>
              </VStack>
              <VStack gap="4" className="flex-1">
                <Label>{t('sttEngines.google.model', 'Модель')}</Label>
                <Select value={model} onChange={e => setModel(e.target.value)}>
                  <option value="general">General</option>
                  <option value="phone_call">Phone Call</option>
                  <option value="command_and_search">Command & Search</option>
                </Select>
              </VStack>
            </HStack>
          )}

          {type === 'yandex' && (
            <>
              <VStack gap="4">
                <Label>{t('sttEngines.yandex.folderId', 'Folder ID')}</Label>
                <Input
                  placeholder="b1g..."
                  value={folderId}
                  onChange={e => setFolderId(e.target.value)}
                />
              </VStack>
              <HStack gap="8">
                <VStack gap="4" className="flex-1">
                  <Label>{t('sttEngines.yandex.languageCode', 'Язык')}</Label>
                  <Select value={languageCode} onChange={e => setLanguageCode(e.target.value)}>
                    <option value="auto">Автоопределение (auto)</option>
                    <option value="ru-RU">Русский (ru-RU)</option>
                    <option value="en-US">English (en-US)</option>
                    <option value="kk-KZ">Казахский (kk-KZ)</option>
                    <option value="uz-UZ">Узбекский (uz-UZ)</option>
                    <option value="de-DE">Немецкий (de-DE)</option>
                    <option value="es-ES">Испанский (es-ES)</option>
                    <option value="fi-FI">Финский (fi-FI)</option>
                    <option value="fr-FR">Французский (fr-FR)</option>
                    <option value="he-IL">Иврит (he-IL)</option>
                    <option value="it-IT">Итальянский (it-IT)</option>
                    <option value="nl-NL">Нидерландский (nl-NL)</option>
                    <option value="pl-PL">Польский (pl-PL)</option>
                    <option value="pt-PT">Португальский (pt-PT)</option>
                    <option value="pt-BR">Португальский (Бразилия) (pt-BR)</option>
                    <option value="sv-SE">Шведский (sv-SE)</option>
                    <option value="tr-TR">Турецкий (tr-TR)</option>
                  </Select>
                </VStack>
                <VStack gap="4" className="flex-1">
                  <Label>{t('sttEngines.yandex.model', 'Модель')}</Label>
                  <Select value={model} onChange={e => setModel(e.target.value)}>
                    <option value="general">{t('sttEngines.yandex.modelGeneral', 'General (Основная)')}</option>
                    <option value="general:rc">{t('sttEngines.yandex.modelGeneralRc', 'General RC')}</option>
                  </Select>
                </VStack>
              </HStack>
              <VStack gap="4">
                <Label>{t('sttEngines.yandex.eouSensitivity', 'EOU Чувствительность')}</Label>
                <Select value={eouSensitivity} onChange={e => setEouSensitivity(e.target.value)}>
                  <option value="DEFAULT">{t('sttEngines.yandex.eouDefault', 'Стандартная')}</option>
                  <option value="HIGH">{t('sttEngines.yandex.eouHigh', 'Высокая (быстрая)')}</option>
                </Select>
              </VStack>
            </>
          )}

          {type === 'custom' && (
            <>
              <VStack gap="4">
                <Label>{t('sttEngines.custom.url', 'URL')}</Label>
                <Input placeholder="https://api.example.com/asr" value={customUrl} onChange={e => setCustomUrl(e.target.value)} />
              </VStack>
              <WebhookAuthConfig
                authMode={authMode}
                token={token}
                customHeaders={customHeaders}
                onAuthModeChange={setAuthMode}
                onTokenChange={setToken}
                onHeadersChange={setCustomHeaders as any}
              />
            </>
          )}
        </VStack>

        <DialogFooter className="mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Отмена')}</Button>
          <Button onClick={handleSubmit} disabled={isCreating || isUpdating || !name.trim()}>{t('common.save', 'Сохранить')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

SttEngineFormModal.displayName = 'SttEngineFormModal';
