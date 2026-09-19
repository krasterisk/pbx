import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Pencil, Plus, ToggleLeft, ToggleRight, Trash2, Wrench } from 'lucide-react';
import { Button, TableRowAction, TableRowActions, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useDeleteAiAgentMutation,
  useGetAiAgentsQuery,
  useGetAiProvidersQuery,
  useGetAiToolsetsQuery,
  useUpdateAiAgentMutation,
  type IAiAgent,
} from '@/shared/api/endpoints/aiAgentsApi';
import { AiAgentModal } from '@/features/ai-agents/ui/AiAgentModal/AiAgentModal';
import cls from './AiAgentsPage.module.scss';

type Tab = 'agents' | 'toolsets';

export const AiAgentsPage = memo(() => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
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
    const provider = providers.find((item) => item.uid === id);
    return provider ? `${provider.name} (${provider.vendor})` : `#${id}`;
  };
  const toolsetName = (id: number | null) =>
    !id ? '-' : (toolsets.find((item) => item.uid === id)?.name || `#${id}`);

  const renderRowActions = (agent: IAiAgent) => (
    <TableRowActions>
      <TableRowAction
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => {
          setEditingAgent(agent);
          setAgentModalOpen(true);
        }}
      >
        <Pencil />
      </TableRowAction>
      <TableRowAction
        danger
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => {
          if (window.confirm(t('aiAgents.confirmDelete', { name: agent.name }))) {
            deleteAgent(agent.uid);
          }
        }}
      >
        <Trash2 />
      </TableRowAction>
    </TableRowActions>
  );

  const agentCards = useMemo(() => agents, [agents]);

  return (
    <VStack gap="24" max className={cls.page} data-testid="ai-agents-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Bot size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('aiAgents.title')}
            </Text>
            <Text variant="muted">
              {t('aiAgents.subtitle')}
            </Text>
            <Text as={Link} to="/ai-robots" variant="muted">
              {t('nav.aiRobotsProduct')}
            </Text>
          </VStack>
        </HStack>
        {tab === 'agents' && (
          <Button
            className={cls.createBtn}
            onClick={() => {
              setEditingAgent(null);
              setAgentModalOpen(true);
            }}
          >
            <Plus size={16} className={cls.createBtnIcon} />
            <Text as="span">{t('aiAgents.newAgent')}</Text>
          </Button>
        )}
      </Flex>

      <HStack gap="4" className={cls.tabs} role="tablist">
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={tab === 'agents'}
          className={`${cls.tab} ${tab === 'agents' ? cls.tabActive : ''}`}
          onClick={() => setTab('agents')}
        >
          <Bot size={16} className={cls.tabIcon} />
          <Text as="span">{t('aiAgents.tabAgents')}</Text>
          <Text as="span" className={cls.tabBadge}>{agents.length}</Text>
        </Button>
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={tab === 'toolsets'}
          className={`${cls.tab} ${tab === 'toolsets' ? cls.tabActive : ''}`}
          onClick={() => setTab('toolsets')}
        >
          <Wrench size={16} className={cls.tabIcon} />
          <Text as="span">{t('aiAgents.tabToolsets')}</Text>
          <Text as="span" className={cls.tabBadge}>{toolsets.length}</Text>
        </Button>
      </HStack>

      {tab === 'agents' && (
        agents.length === 0 ? (
          <EmptyState
            icon={<Bot size={48} />}
            title={t('aiAgents.empty.agents')}
            hint={t('aiAgents.empty.agentsHint')}
          />
        ) : isMobile ? (
          <VStack
            gap="8"
            max
            className={cls.mobileList}
            data-testid="hybrid-table"
            data-hybrid="mobile-card"
          >
            {agentCards.map((agent) => (
              <Flex
                key={agent.uid}
                direction="column"
                className={cls.mobileCard}
                data-testid="ai-agents-mobile-card"
              >
                <HStack justify="between" align="start" max>
                  <VStack gap="4">
                    <Text as="span" className={cls.bold}>{agent.name}</Text>
                    <Text as="span" className={cls.uniqueId}>{agent.unique_id}</Text>
                    <Text
                      as="span"
                      className={`${cls.chip} ${agent.mode === 'realtime' ? cls.chipRealtime : cls.chipCascade}`}
                    >
                      {agent.mode}
                    </Text>
                    <Text as="span" className={cls.cell}>{providerName(agent.model_profile_id)}</Text>
                  </VStack>
                  {renderRowActions(agent)}
                </HStack>
              </Flex>
            ))}
          </VStack>
        ) : (
          <Flex
            direction="column"
            align="stretch"
            max
            className={cls.tableWrap}
            data-testid="hybrid-table"
            data-hybrid="overflow-x-auto"
          >
            <table className={cls.table}>
              <thead>
                <tr>
                  <th>{t('aiAgents.col.name')}</th>
                  <th>{t('aiAgents.col.uniqueId')}</th>
                  <th>{t('aiAgents.col.mode')}</th>
                  <th>{t('aiAgents.col.model')}</th>
                  <th>{t('aiAgents.col.toolset')}</th>
                  <th>{t('aiAgents.col.enabled')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.uid}>
                    <td>
                      <VStack gap="4">
                        <Text className={cls.bold}>{agent.name}</Text>
                        {agent.greeting ? (
                          <Text variant="muted" className={cls.greeting}>{agent.greeting}</Text>
                        ) : null}
                      </VStack>
                    </td>
                    <td>
                      <Text as="span" className={cls.uniqueId}>{agent.unique_id}</Text>
                    </td>
                    <td>
                      <Text
                        as="span"
                        className={`${cls.chip} ${agent.mode === 'realtime' ? cls.chipRealtime : cls.chipCascade}`}
                      >
                        {agent.mode}
                      </Text>
                    </td>
                    <td>
                      <Text as="span" className={cls.cell}>{providerName(agent.model_profile_id)}</Text>
                    </td>
                    <td>
                      <Text as="span" className={cls.cell}>{toolsetName(agent.toolset_id)}</Text>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        className={cls.toggleBtn}
                        onClick={() => updateAgent({ id: agent.uid, data: { enabled: !agent.enabled } })}
                        title={t('aiAgents.toggleHint')}
                        aria-label={t('aiAgents.toggleHint')}
                      >
                        {agent.enabled
                          ? <ToggleRight size={20} className={cls.toggleOn} />
                          : <ToggleLeft size={20} className={cls.toggleOff} />}
                      </Button>
                    </td>
                    <td>{renderRowActions(agent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Flex>
        )
      )}

      {tab === 'toolsets' && (
        <EmptyState
          icon={<Wrench size={48} />}
          title={t('aiAgents.empty.toolsets')}
          hint={t('aiAgents.empty.toolsetsHint')}
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
});

AiAgentsPage.displayName = 'AiAgentsPage';

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <VStack align="center" gap="8" className={cls.empty}>
      <Flex align="center" justify="center" className={cls.emptyIcon}>
        {icon}
      </Flex>
      <Text className={cls.emptyTitle}>{title}</Text>
      <Text variant="muted">{hint}</Text>
    </VStack>
  );
}
