import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus, Wrench, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetAiAgentsQuery,
  useGetAiProvidersQuery,
  useGetAiToolsetsQuery,
  useDeleteAiAgentMutation,
  useUpdateAiAgentMutation,
  type IAiAgent,
} from '@/shared/api/endpoints/aiAgentsApi';
import { AiAgentModal } from '@/features/ai-agents/ui/AiAgentModal/AiAgentModal';
import styles from './AiAgentsPage.module.scss';

type Tab = 'agents' | 'toolsets';

export function AiAgentsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('agents');

  const { data: agents = [] } = useGetAiAgentsQuery();
  const { data: providers = [] } = useGetAiProvidersQuery();
  const { data: toolsets = [] } = useGetAiToolsetsQuery();

  const [deleteAgent] = useDeleteAiAgentMutation();
  const [updateAgent] = useUpdateAiAgentMutation();

  const [editingAgent, setEditingAgent] = useState<IAiAgent | null>(null);
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  const providerName = (id: number | null) => {
    if (!id) return '-';
    const p = providers.find(x => x.uid === id);
    return p ? `${p.name} (${p.vendor})` : `#${id}`;
  };
  const toolsetName = (id: number | null) =>
    !id ? '-' : (toolsets.find(t => t.uid === id)?.name || `#${id}`);

  return (
    <VStack gap="24" max className={styles.page} data-testid="ai-agents-page-responsive">
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
        <VStack gap="4" className="min-w-0">
          <HStack gap="12" align="center">
            <Bot className="w-7 h-7 text-primary shrink-0" />
            <h1 className="text-2xl font-bold">
              {t('aiAgents.title', 'AI Agents')}
            </h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            {t('aiAgents.subtitle', 'Voice AI agents for inbound calls')}
          </p>
        </VStack>

        <HStack gap="8" className="w-full sm:w-auto">
          {tab === 'agents' && (
            <Button className={styles.createBtn} onClick={() => { setEditingAgent(null); setAgentModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('aiAgents.newAgent', 'New AI Agent')}
            </Button>
          )}
        </HStack>
      </HStack>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'agents' ? styles.tabActive : ''}`}
          onClick={() => setTab('agents')}
        >
          <Bot className="w-4 h-4 mr-1.5 inline" />
          {t('aiAgents.tabAgents', 'Agents')}
          <span className={styles.tabBadge}>{agents.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'toolsets' ? styles.tabActive : ''}`}
          onClick={() => setTab('toolsets')}
        >
          <Wrench className="w-4 h-4 mr-1.5 inline" />
          {t('aiAgents.tabToolsets', 'Toolsets')}
          <span className={styles.tabBadge}>{toolsets.length}</span>
        </button>
      </div>

      {tab === 'agents' && (
        <div
          className={`${styles.tableWrap} overflow-x-auto`}
          data-testid="hybrid-table"
          data-hybrid="overflow-x-auto"
        >
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
                        type="button"
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

      {tab === 'toolsets' && (
        <EmptyState
          icon={<Wrench className="w-12 h-12 opacity-50" />}
          title={t('aiAgents.empty.toolsets', 'No toolsets yet')}
          hint={t('aiAgents.empty.toolsetsHint', 'Toolset editor lands in AI-3 (Tool Calling). The CRUD API is already available.')}
        />
      )}

      {agentModalOpen && (
        <AiAgentModal
          agent={editingAgent}
          providers={providers}
          toolsets={toolsets}
          onClose={() => setAgentModalOpen(false)}
        />
      )}
    </VStack>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className={styles.empty}>
      {icon}
      <Text className={styles.emptyTitle}>{title}</Text>
      <Text variant="muted">{hint}</Text>
    </div>
  );
}
