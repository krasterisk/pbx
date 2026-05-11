import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plug, Plus, Wrench, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetAiAgentsQuery,
  useGetAiProvidersQuery,
  useGetAiToolsetsQuery,
  useDeleteAiAgentMutation,
  useDeleteAiProviderMutation,
  useCloneAiProviderMutation,
  useUpdateAiAgentMutation,
  type IAiAgent,
  type IAiProvider,
} from '@/shared/api/endpoints/aiAgentsApi';
import { AiAgentModal } from '@/features/ai-agents/ui/AiAgentModal/AiAgentModal';
import { AiProviderModal } from '@/features/ai-agents/ui/AiProviderModal/AiProviderModal';
import styles from './AiAgentsPage.module.scss';

type Tab = 'agents' | 'providers' | 'toolsets';

export function AiAgentsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('agents');

  const { data: agents = [] } = useGetAiAgentsQuery();
  const { data: providers = [] } = useGetAiProvidersQuery();
  const { data: toolsets = [] } = useGetAiToolsetsQuery();

  const [deleteAgent] = useDeleteAiAgentMutation();
  const [deleteProvider] = useDeleteAiProviderMutation();
  const [cloneProvider] = useCloneAiProviderMutation();
  const [updateAgent] = useUpdateAiAgentMutation();

  const [editingAgent, setEditingAgent] = useState<IAiAgent | null>(null);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<IAiProvider | null>(null);
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  // Resolve provider name by uid for the agents table
  const providerName = (id: number | null) => {
    if (!id) return '—';
    const p = providers.find(x => x.uid === id);
    return p ? `${p.name} (${p.vendor})` : `#${id}`;
  };
  const toolsetName = (id: number | null) =>
    !id ? '—' : (toolsets.find(t => t.uid === id)?.name || `#${id}`);

  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <Bot className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">
              {t('aiAgents.title', 'AI Agents')}
            </h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            {t('aiAgents.subtitle', 'LLM-based operators, providers, and toolsets')}
          </p>
        </VStack>

        <HStack gap="8">
          {tab === 'agents' && (
            <Button onClick={() => { setEditingAgent(null); setAgentModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('aiAgents.newAgent', 'New AI Agent')}
            </Button>
          )}
          {tab === 'providers' && (
            <Button onClick={() => { setEditingProvider(null); setProviderModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('aiAgents.newProvider', 'New Provider')}
            </Button>
          )}
        </HStack>
      </HStack>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'agents' ? styles.tabActive : ''}`}
          onClick={() => setTab('agents')}
        >
          <Bot className="w-4 h-4 mr-1.5 inline" />
          {t('aiAgents.tabAgents', 'Agents')}
          <span className={styles.tabBadge}>{agents.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'providers' ? styles.tabActive : ''}`}
          onClick={() => setTab('providers')}
        >
          <Plug className="w-4 h-4 mr-1.5 inline" />
          {t('aiAgents.tabProviders', 'Providers')}
          <span className={styles.tabBadge}>{providers.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'toolsets' ? styles.tabActive : ''}`}
          onClick={() => setTab('toolsets')}
        >
          <Wrench className="w-4 h-4 mr-1.5 inline" />
          {t('aiAgents.tabToolsets', 'Toolsets')}
          <span className={styles.tabBadge}>{toolsets.length}</span>
        </button>
      </div>

      {/* ─── Agents ─── */}
      {tab === 'agents' && (
        <div className={styles.tableWrap}>
          {agents.length === 0 ? (
            <EmptyState
              icon={<Bot className="w-12 h-12 opacity-50" />}
              title={t('aiAgents.empty.agents', 'No AI agents yet')}
              hint={t('aiAgents.empty.agentsHint', 'Create one to handle calls automatically.')}
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('aiAgents.col.name', 'Name')}</th>
                  <th>{t('aiAgents.col.uniqueId', 'Unique ID')}</th>
                  <th>{t('aiAgents.col.mode', 'Mode')}</th>
                  <th>{t('aiAgents.col.model', 'Model')}</th>
                  <th>{t('aiAgents.col.toolset', 'Toolset')}</th>
                  <th>{t('aiAgents.col.enabled', 'Enabled')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.uid}>
                    <td>
                      <Text className={styles.bold}>{a.name}</Text>
                      {a.greeting && (
                        <Text variant="muted" className="text-xs truncate max-w-[260px]">
                          {a.greeting}
                        </Text>
                      )}
                    </td>
                    <td><code>{a.unique_id}</code></td>
                    <td>
                      <span className={`${styles.chip} ${a.mode === 'realtime' ? styles.chipRealtime : styles.chipCascade}`}>
                        {a.mode}
                      </span>
                    </td>
                    <td>{providerName(a.model_profile_id)}</td>
                    <td>{toolsetName(a.toolset_id)}</td>
                    <td>
                      <button
                        className={styles.toggleBtn}
                        onClick={() => updateAgent({ id: a.uid, data: { enabled: !a.enabled } })}
                        title={t('aiAgents.toggleHint', 'Toggle enabled')}
                      >
                        {a.enabled
                          ? <ToggleRight className="w-5 h-5 text-success" />
                          : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                      </button>
                    </td>
                    <td>
                      <HStack gap="4">
                        <Button variant="outline" size="sm" onClick={() => { setEditingAgent(a); setAgentModalOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(t('aiAgents.confirmDelete', 'Delete agent "{{name}}"?', { name: a.name }))) {
                              deleteAgent(a.uid);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </HStack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Providers ─── */}
      {tab === 'providers' && (
        <div className={styles.tableWrap}>
          {providers.length === 0 ? (
            <EmptyState
              icon={<Plug className="w-12 h-12 opacity-50" />}
              title={t('aiAgents.empty.providers', 'No providers configured')}
              hint={t('aiAgents.empty.providersHint', 'Built-in templates are seeded automatically; clone one to attach your API key.')}
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('aiAgents.col.name', 'Name')}</th>
                  <th>{t('aiAgents.col.vendor', 'Vendor')}</th>
                  <th>{t('aiAgents.col.kind', 'Kind')}</th>
                  <th>{t('aiAgents.col.capabilities', 'Capabilities')}</th>
                  <th>{t('aiAgents.col.enabled', 'Enabled')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {providers.map(p => {
                  const isGlobal = p.user_uid === 0;
                  return (
                    <tr key={p.uid} className={isGlobal ? styles.rowGlobal : ''}>
                      <td>
                        <Text className={styles.bold}>{p.name}</Text>
                        {isGlobal && (
                          <span className={`${styles.chip} ${styles.chipGlobal}`}>
                            {t('aiAgents.template', 'template')}
                          </span>
                        )}
                      </td>
                      <td>{p.vendor}</td>
                      <td>{p.kind}</td>
                      <td>
                        <HStack gap="4">
                          {p.capabilities.map(c => (
                            <span key={c} className={styles.cap}>{c}</span>
                          ))}
                        </HStack>
                      </td>
                      <td>{p.enabled
                        ? <span className={styles.statusOk}>●</span>
                        : <span className={styles.statusOff}>●</span>}
                      </td>
                      <td>
                        <HStack gap="4">
                          {isGlobal ? (
                            <Button variant="outline" size="sm" onClick={() => cloneProvider(p.uid)}>
                              {t('aiAgents.cloneTemplate', 'Clone')}
                            </Button>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => { setEditingProvider(p); setProviderModalOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(t('aiAgents.confirmDeleteProvider', 'Delete provider "{{name}}"?', { name: p.name }))) {
                                    deleteProvider(p.uid);
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                        </HStack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Toolsets (placeholder for AI-1) ─── */}
      {tab === 'toolsets' && (
        <EmptyState
          icon={<Wrench className="w-12 h-12 opacity-50" />}
          title={t('aiAgents.empty.toolsets', 'No toolsets yet')}
          hint={t('aiAgents.empty.toolsetsHint', 'Toolset editor lands in AI-3 (Tool Calling). The CRUD API is already available.')}
        />
      )}

      {/* Modals */}
      {agentModalOpen && (
        <AiAgentModal
          agent={editingAgent}
          providers={providers}
          toolsets={toolsets}
          onClose={() => setAgentModalOpen(false)}
        />
      )}
      {providerModalOpen && (
        <AiProviderModal
          provider={editingProvider}
          onClose={() => setProviderModalOpen(false)}
        />
      )}
    </VStack>
  );
}

// ─── Tiny inline helpers ───────────────────────────────────

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className={styles.empty}>
      {icon}
      <Text className={styles.emptyTitle}>{title}</Text>
      <Text variant="muted">{hint}</Text>
    </div>
  );
}
