import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, X, Save, KeyRound } from 'lucide-react';
import { Button, Input, Label, Text, Select } from '@/shared/ui';
import {
  useCreateAiProviderMutation,
  useUpdateAiProviderMutation,
  type IAiProvider,
  type AiCapability,
  type AiProviderKind,
} from '@/shared/api/endpoints/aiAgentsApi';
import styles from './AiProviderModal.module.scss';

interface Props {
  provider: IAiProvider | null;
  onClose: () => void;
}

const ALL_CAPS: AiCapability[] = ['llm', 'stt', 'tts', 'realtime'];

export function AiProviderModal({ provider, onClose }: Props) {
  const { t } = useTranslation();
  const isEdit = !!provider;

  const [name, setName] = useState(provider?.name || '');
  const [vendor, setVendor] = useState(provider?.vendor || 'openai');
  const [kind, setKind] = useState<AiProviderKind>(provider?.kind || 'online');
  const [endpoint, setEndpoint] = useState(provider?.endpoint || '');
  const [authType, setAuthType] = useState(provider?.auth_type || 'bearer');
  const [apiKey, setApiKey] = useState('');
  const [caps, setCaps] = useState<AiCapability[]>(provider?.capabilities || ['llm']);
  const [enabled, setEnabled] = useState(provider?.enabled !== false);
  const [defaultsJson, setDefaultsJson] = useState(
    JSON.stringify(provider?.defaults || {}, null, 2),
  );
  const [pricingJson, setPricingJson] = useState(
    JSON.stringify(provider?.pricing || { inputTokenUsd: 0, outputTokenUsd: 0 }, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createProvider] = useCreateAiProviderMutation();
  const [updateProvider] = useUpdateAiProviderMutation();

  const toggleCap = (c: AiCapability) => {
    setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError(t('aiAgents.error.nameRequired', 'Name is required'));
    if (!endpoint.trim()) return setError(t('aiAgents.error.endpointRequired', 'Endpoint is required'));
    if (caps.length === 0) return setError(t('aiAgents.error.capsRequired', 'Pick at least one capability'));

    let defaults: Record<string, unknown>;
    let pricing: Record<string, number>;
    try { defaults = JSON.parse(defaultsJson || '{}'); }
    catch { return setError(t('aiAgents.error.defaultsJson', 'Defaults: invalid JSON')); }
    try { pricing = JSON.parse(pricingJson || '{}'); }
    catch { return setError(t('aiAgents.error.pricingJson', 'Pricing: invalid JSON')); }

    const payload: any = {
      name: name.trim(),
      vendor: vendor.trim(),
      kind,
      endpoint: endpoint.trim(),
      auth_type: authType,
      capabilities: caps,
      defaults,
      pricing,
      enabled,
    };
    if (apiKey) payload.apiKey = apiKey;

    setSubmitting(true);
    try {
      if (isEdit && provider) {
        await updateProvider({ id: provider.uid, data: payload }).unwrap();
      } else {
        await createProvider(payload).unwrap();
      }
      onClose();
    } catch (err: any) {
      setError(err?.data?.message || err?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>
            <Plug className="w-5 h-5 inline mr-2" />
            {isEdit ? t('aiAgents.editProvider', 'Edit Provider') : t('aiAgents.createProvider', 'New Provider')}
          </span>
          <button className={styles.close} onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.grid2}>
            <div className={styles.row}>
              <Label>{t('aiAgents.field.name', 'Name')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="My OpenAI" />
            </div>
            <div className={styles.row}>
              <Label>{t('aiAgents.field.vendor', 'Vendor')}</Label>
              <Input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="openai" />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.row}>
              <Label>{t('aiAgents.field.kind', 'Kind')}</Label>
              <Select value={kind} onChange={(e: any) => setKind(e.target.value as AiProviderKind)}>
                <option value="online">online</option>
                <option value="local">local</option>
                <option value="custom">custom</option>
              </Select>
            </div>
            <div className={styles.row}>
              <Label>{t('aiAgents.field.authType', 'Auth Type')}</Label>
              <Select value={authType} onChange={(e: any) => setAuthType(e.target.value)}>
                <option value="bearer">bearer</option>
                <option value="iam">iam (Yandex)</option>
                <option value="none">none</option>
              </Select>
            </div>
          </div>

          <div className={styles.row}>
            <Label>{t('aiAgents.field.endpoint', 'Endpoint')}</Label>
            <Input
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              placeholder="wss://api.openai.com/v1/realtime"
            />
          </div>

          <div className={styles.row}>
            <Label>
              <KeyRound className="w-4 h-4 inline mr-1.5" />
              {t('aiAgents.field.apiKey', 'API Key')}
              {isEdit && (
                <span className="text-xs text-muted-foreground ml-2">
                  {t('aiAgents.field.apiKeyEditHint', '(leave blank to keep existing)')}
                </span>
              )}
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="new-password"
            />
            <Text variant="muted" className="text-xs mt-1">
              {t('aiAgents.field.apiKeySecurityHint', 'Stored encrypted (AES-256-GCM) with the CC_AI_KEY_SECRET environment key.')}
            </Text>
          </div>

          <div className={styles.row}>
            <Label>{t('aiAgents.field.capabilities', 'Capabilities')}</Label>
            <div className={styles.capRow}>
              {ALL_CAPS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.capBtn} ${caps.includes(c) ? styles.capBtnActive : ''}`}
                  onClick={() => toggleCap(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.row}>
              <Label>{t('aiAgents.field.defaults', 'Defaults (JSON)')}</Label>
              <textarea
                className={styles.textarea}
                value={defaultsJson}
                onChange={e => setDefaultsJson(e.target.value)}
                rows={6}
              />
            </div>
            <div className={styles.row}>
              <Label>{t('aiAgents.field.pricing', 'Pricing (JSON, USD)')}</Label>
              <textarea
                className={styles.textarea}
                value={pricingJson}
                onChange={e => setPricingJson(e.target.value)}
                rows={6}
              />
            </div>
          </div>

          <div className={styles.row}>
            <Label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              {t('aiAgents.field.enabled', 'Enabled')}
            </Label>
          </div>

          {error && (
            <div className={styles.error}>
              <Text>{error}</Text>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <Save className="w-4 h-4 mr-1" />
            {isEdit ? t('common.save', 'Save') : t('common.create', 'Create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
