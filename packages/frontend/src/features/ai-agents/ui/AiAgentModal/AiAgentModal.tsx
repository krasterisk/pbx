import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, X, Save, Settings, Workflow, Phone } from 'lucide-react';
import { Button, Input, Label, Text, Select } from '@/shared/ui';
import {
  useCreateAiAgentMutation,
  useUpdateAiAgentMutation,
  type IAiAgent,
  type IAiProvider,
  type IAiToolset,
  type AiPipelineMode,
} from '@/shared/api/endpoints/aiAgentsApi';
import styles from './AiAgentModal.module.scss';

interface Props {
  agent: IAiAgent | null;
  providers: IAiProvider[];
  toolsets: IAiToolset[];
  onClose: () => void;
}

type Tab = 'general' | 'pipeline' | 'routing';

export function AiAgentModal({ agent, providers, toolsets, onClose }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('general');
  const isEdit = !!agent;

  const [name, setName] = useState(agent?.name || '');
  const [uniqueId, setUniqueId] = useState(agent?.unique_id || '');
  const [mode, setMode] = useState<AiPipelineMode>(agent?.mode || 'realtime');
  const [voice, setVoice] = useState(agent?.voice || '');
  const [greeting, setGreeting] = useState(agent?.greeting || '');
  const [instruction, setInstruction] = useState(agent?.instruction || '');
  const [modelProfileId, setModelProfileId] = useState<number | ''>(agent?.model_profile_id ?? '');
  const [sttProfileId, setSttProfileId] = useState<number | ''>(agent?.stt_profile_id ?? '');
  const [ttsProfileId, setTtsProfileId] = useState<number | ''>(agent?.tts_profile_id ?? '');
  const [toolsetId, setToolsetId] = useState<number | ''>(agent?.toolset_id ?? '');
  const [channelKind, setChannelKind] = useState(agent?.channel_kind || 'local');
  const [enabled, setEnabled] = useState(agent?.enabled !== false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createAgent] = useCreateAiAgentMutation();
  const [updateAgent] = useUpdateAiAgentMutation();

  // Filter providers by capability for the right-mode dropdowns
  const llmProviders = useMemo(() => providers.filter(p => p.enabled && (p.capabilities.includes('llm') || p.capabilities.includes('realtime'))), [providers]);
  const sttProviders = useMemo(() => providers.filter(p => p.enabled && p.capabilities.includes('stt')), [providers]);
  const ttsProviders = useMemo(() => providers.filter(p => p.enabled && p.capabilities.includes('tts')), [providers]);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError(t('aiAgents.error.nameRequired', 'Name is required'));
    if (!uniqueId.trim()) return setError(t('aiAgents.error.uniqueIdRequired', 'Unique ID is required'));
    if (!/^[A-Za-z0-9_\-]+$/.test(uniqueId)) {
      return setError(t('aiAgents.error.uniqueIdFormat', 'Unique ID may only contain [A-Za-z0-9_-]'));
    }
    if (!modelProfileId) return setError(t('aiAgents.error.llmRequired', 'LLM/model profile is required'));
    if (mode === 'cascade') {
      if (!sttProfileId) return setError(t('aiAgents.error.sttRequired', 'STT profile is required for cascade mode'));
      if (!ttsProfileId) return setError(t('aiAgents.error.ttsRequired', 'TTS profile is required for cascade mode'));
    }

    const payload = {
      name: name.trim(),
      unique_id: uniqueId.trim(),
      mode,
      voice: voice.trim(),
      greeting: greeting.trim(),
      instruction: instruction.trim(),
      model_profile_id: Number(modelProfileId) || undefined,
      stt_profile_id: sttProfileId ? Number(sttProfileId) : undefined,
      tts_profile_id: ttsProfileId ? Number(ttsProfileId) : undefined,
      toolset_id: toolsetId ? Number(toolsetId) : undefined,
      channel_kind: channelKind as 'local' | 'pjsip' | 'sip',
      enabled,
    };

    setSubmitting(true);
    try {
      if (isEdit && agent) {
        await updateAgent({ id: agent.uid, data: payload }).unwrap();
      } else {
        await createAgent(payload).unwrap();
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
            <Bot className="w-5 h-5 inline mr-2" />
            {isEdit ? t('aiAgents.edit', 'Edit AI Agent') : t('aiAgents.create', 'New AI Agent')}
          </span>
          <button className={styles.close} onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'general' ? styles.tabActive : ''}`}
            onClick={() => setTab('general')}
          >
            <Settings className="w-4 h-4 mr-1 inline" />
            {t('aiAgents.tab.general', 'General')}
          </button>
          <button
            className={`${styles.tab} ${tab === 'pipeline' ? styles.tabActive : ''}`}
            onClick={() => setTab('pipeline')}
          >
            <Workflow className="w-4 h-4 mr-1 inline" />
            {t('aiAgents.tab.pipeline', 'Pipeline')}
          </button>
          <button
            className={`${styles.tab} ${tab === 'routing' ? styles.tabActive : ''}`}
            onClick={() => setTab('routing')}
          >
            <Phone className="w-4 h-4 mr-1 inline" />
            {t('aiAgents.tab.routing', 'Routing')}
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'general' && (
            <>
              <div className={styles.row}>
                <Label>{t('aiAgents.field.name', 'Name')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Sales Bot" />
              </div>
              <div className={styles.row}>
                <Label>{t('aiAgents.field.uniqueId', 'Unique ID')}</Label>
                <Input value={uniqueId} onChange={e => setUniqueId(e.target.value)} placeholder="sales-bot" />
                <Text variant="muted" className="text-xs mt-1">
                  {t('aiAgents.field.uniqueIdHint', 'Used in Asterisk dialplan: Dial(Local/{unique_id}@ai-agents).')}
                </Text>
              </div>
              <div className={styles.row}>
                <Label>{t('aiAgents.field.greeting', 'Greeting')}</Label>
                <Input value={greeting} onChange={e => setGreeting(e.target.value)} placeholder="Hello, how can I help?" />
              </div>
              <div className={styles.row}>
                <Label>{t('aiAgents.field.instruction', 'System Prompt')}</Label>
                <textarea
                  className={styles.textarea}
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  rows={6}
                  placeholder="You are a helpful sales agent for ..."
                />
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
            </>
          )}

          {tab === 'pipeline' && (
            <>
              <div className={styles.row}>
                <Label>{t('aiAgents.field.mode', 'Mode')}</Label>
                <Select
                  value={mode}
                  onChange={(e: any) => setMode(e.target.value as AiPipelineMode)}
                >
                  <option value="realtime">realtime (speech-to-speech)</option>
                  <option value="cascade">cascade (STT → LLM → TTS)</option>
                </Select>
                <Text variant="muted" className="text-xs mt-1">
                  {mode === 'realtime'
                    ? t('aiAgents.field.modeRealtimeHint', 'Single bidirectional connection — lowest latency. Pick a provider that supports the realtime capability.')
                    : t('aiAgents.field.modeCascadeHint', 'STT and TTS are wired separately — pick all three profiles below.')}
                </Text>
              </div>

              <div className={styles.row}>
                <Label>{t('aiAgents.field.llm', 'LLM / Realtime')}</Label>
                <Select value={modelProfileId} onChange={(e: any) => setModelProfileId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">—</option>
                  {llmProviders.map(p => (
                    <option key={p.uid} value={p.uid}>
                      {p.name} ({p.vendor}) {p.user_uid === 0 ? '— template' : ''}
                    </option>
                  ))}
                </Select>
              </div>

              {mode === 'cascade' && (
                <>
                  <div className={styles.row}>
                    <Label>{t('aiAgents.field.stt', 'STT (Speech → Text)')}</Label>
                    <Select value={sttProfileId} onChange={(e: any) => setSttProfileId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">—</option>
                      {sttProviders.map(p => (
                        <option key={p.uid} value={p.uid}>{p.name} ({p.vendor})</option>
                      ))}
                    </Select>
                  </div>
                  <div className={styles.row}>
                    <Label>{t('aiAgents.field.tts', 'TTS (Text → Speech)')}</Label>
                    <Select value={ttsProfileId} onChange={(e: any) => setTtsProfileId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">—</option>
                      {ttsProviders.map(p => (
                        <option key={p.uid} value={p.uid}>{p.name} ({p.vendor})</option>
                      ))}
                    </Select>
                  </div>
                  <div className={styles.row}>
                    <Label>{t('aiAgents.field.voice', 'Voice ID')}</Label>
                    <Input value={voice} onChange={e => setVoice(e.target.value)} placeholder="ru-RU-female-1" />
                  </div>
                </>
              )}

              <div className={styles.row}>
                <Label>{t('aiAgents.field.toolset', 'Toolset (optional)')}</Label>
                <Select value={toolsetId} onChange={(e: any) => setToolsetId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">—</option>
                  {toolsets.map(ts => (
                    <option key={ts.uid} value={ts.uid}>{ts.name}</option>
                  ))}
                </Select>
              </div>
            </>
          )}

          {tab === 'routing' && (
            <>
              <div className={styles.row}>
                <Label>{t('aiAgents.field.channelKind', 'Channel kind')}</Label>
                <Select value={channelKind} onChange={(e: any) => setChannelKind(e.target.value)}>
                  <option value="local">local — Local/{'{unique_id}'}@ai-agents</option>
                  <option value="pjsip">pjsip — PJSIP/{'{unique_id}'}</option>
                  <option value="sip">sip — SIP/{'{unique_id}'}</option>
                </Select>
                <Text variant="muted" className="text-xs mt-1">
                  {t('aiAgents.field.channelKindHint', 'Used by Asterisk dialplan and queues to dial this agent. Most setups use "local".')}
                </Text>
              </div>

              <div className={styles.callout}>
                <Text className={styles.calloutTitle}>
                  {t('aiAgents.routing.howTo', 'How to route calls')}
                </Text>
                <pre className={styles.code}>{`exten => 100,1,Dial(${{
local: 'Local/',
pjsip: 'PJSIP/',
sip: 'SIP/',
}[channelKind]}${uniqueId || 'my-agent'}@ai-agents,60)`}</pre>
                <Text variant="muted" className="text-xs">
                  {t('aiAgents.routing.queueHint', 'For a queue, add the agent to it like any other static member.')}
                </Text>
              </div>
            </>
          )}

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
