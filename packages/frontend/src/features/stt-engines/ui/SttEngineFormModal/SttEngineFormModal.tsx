import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import { Button, Input, VStack, HStack, WebhookAuthConfig, type AuthMode } from '@/shared/ui';
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
  const [createEngine] = useCreateSttEngineMutation();
  const [updateEngine] = useUpdateSttEngineMutation();

  const [name, setName] = useState('');
  const [type, setType] = useState<EngineType>('google');
  const [token, setToken] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);

  // Google/Yandex settings
  const [languageCode, setLanguageCode] = useState('ru-RU');
  const [model, setModel] = useState('general');
  const [folderId, setFolderId] = useState('');

  useEffect(() => {
    if (engine) {
      setName(engine.name || '');
      setType(engine.type || 'google');
      setToken(engine.token || '');
      setCustomUrl(engine.custom_url || '');
      setAuthMode(engine.auth_mode || 'none');
      const s = engine.settings || {};
      setLanguageCode(s.language_code || 'ru-RU');
      setModel(s.model || 'general');
      setFolderId(s.folder_id || '');
      const hdrs = engine.custom_headers || {};
      setCustomHeaders(Object.entries(hdrs).map(([key, value]) => ({ key, value })));
    } else {
      setName(''); setType('google'); setToken(''); setCustomUrl('');
      setAuthMode('none'); setLanguageCode('ru-RU'); setModel('general');
      setFolderId(''); setCustomHeaders([]);
    }
  }, [engine, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const settings: Record<string, any> = {};
    if (type === 'google') { settings.language_code = languageCode; settings.model = model; }
    if (type === 'yandex') { settings.language_code = languageCode; settings.folder_id = folderId; settings.model = model; }

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
      else { await createEngine(payload).unwrap(); }
      onClose();
    } catch (err) { console.error('Failed to save STT engine', err); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {engine ? t('sttEngines.edit', 'Редактировать движок') : t('sttEngines.add', 'Добавить движок')}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16">
          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">{t('sttEngines.name', 'Название')}</label>
            <Input placeholder="Google ASR" value={name} onChange={e => setName(e.target.value)} />
          </VStack>

          {/* Type selector */}
          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">{t('sttEngines.type', 'Тип')}</label>
            <HStack gap="8">
              {(['google', 'yandex', 'custom'] as EngineType[]).map(tp => (
                <button key={tp} type="button"
                  className={`flex-1 py-2 px-3 border rounded-lg text-sm font-medium transition-all ${type === tp ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
                  onClick={() => setType(tp)}>
                  {tp === 'google' ? 'Google' : tp === 'yandex' ? 'Yandex' : 'Custom'}
                </button>
              ))}
            </HStack>
          </VStack>

          {type !== 'custom' && (
            <VStack gap="4">
              <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.token', 'API Key / Token')}</label>
              <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="AIza..." />
            </VStack>
          )}

          {type === 'google' && (
            <HStack gap="8">
              <VStack gap="4" style={{ flex: 1 }}>
                <label className="text-sm font-medium text-muted-foreground">Language</label>
                <Input value={languageCode} onChange={e => setLanguageCode(e.target.value)} placeholder="ru-RU" />
              </VStack>
              <VStack gap="4" style={{ flex: 1 }}>
                <label className="text-sm font-medium text-muted-foreground">Model</label>
                <select className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                  value={model} onChange={e => setModel(e.target.value)}>
                  <option value="general">General</option>
                  <option value="phone_call">Phone Call</option>
                  <option value="command_and_search">Command & Search</option>
                </select>
              </VStack>
            </HStack>
          )}

          {type === 'yandex' && (
            <>
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">{t('ttsEngines.yandex.folderId', 'Folder ID')}</label>
                <Input value={folderId} onChange={e => setFolderId(e.target.value)} placeholder="b1g..." />
              </VStack>
              <HStack gap="8">
                <VStack gap="4" style={{ flex: 1 }}>
                  <label className="text-sm font-medium text-muted-foreground">Language</label>
                  <Input value={languageCode} onChange={e => setLanguageCode(e.target.value)} placeholder="ru-RU" />
                </VStack>
                <VStack gap="4" style={{ flex: 1 }}>
                  <label className="text-sm font-medium text-muted-foreground">Model</label>
                  <select className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                    value={model} onChange={e => setModel(e.target.value)}>
                    <option value="general">General</option>
                    <option value="general:rc">General RC</option>
                  </select>
                </VStack>
              </HStack>
            </>
          )}

          {type === 'custom' && (
            <>
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">URL</label>
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
