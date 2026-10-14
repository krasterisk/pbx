import { AiAgentModal } from "@/features/ai-agents/ui/AiAgentModal/AiAgentModal";
import {
  useDeleteAiAgentMutation,
  useGetAiAgentsQuery,
  useGetAiProvidersQuery,
  useGetAiToolsetsQuery,
  useUpdateAiAgentMutation,
  type IAiAgent,
} from "@/shared/api/endpoints/aiAgentsApi";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import {
  Button,
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectionCell,
  TableToolbar,
  Text,
} from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import { Bot, Plus, ToggleLeft, ToggleRight, Wrench } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import cls from "./AiAgentsPage.module.scss";

type Tab = "agents" | "toolsets";

export const AiAgentsPage = memo(() => {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const [tab, setTab] = useState<Tab>("agents");

  const {
    data: agents = [],
    isError: agentsLoadError,
    refetch: retryAgents,
  } = useGetAiAgentsQuery();
  const { data: providers = [] } = useGetAiProvidersQuery();
  const {
    data: toolsets = [],
    isError: toolsetsLoadError,
    refetch: retryToolsets,
  } = useGetAiToolsetsQuery();

  const [deleteAgent] = useDeleteAiAgentMutation();
  const [updateAgent] = useUpdateAiAgentMutation();

  const [editingAgent, setEditingAgent] = useState<IAiAgent | null>(null);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const selection = useCrossPageRowSelection({ globalFilter: "" });
  const [deletingSelected, setDeletingSelected] = useState(false);

  const providerName = (id: number | null) => {
    if (!id) return "-";
    const provider = providers.find((item) => item.uid === id);
    return provider ? `${provider.name} (${provider.vendor})` : `#${id}`;
  };
  const toolsetName = (id: number | null) =>
    !id ? "-" : toolsets.find((item) => item.uid === id)?.name || `#${id}`;

  const deleteSelected = async () => {
    const selected = agents.filter(
      (agent) => selection.rowSelection[String(agent.uid)],
    );
    if (
      !selected.length ||
      deletingSelected ||
      !window.confirm(
        t("aiAgents.confirmDelete", {
          name: selected.map((agent) => agent.name).join(", "),
        }),
      )
    )
      return;
    setDeletingSelected(true);
    try {
      for (const agent of selected) {
        await deleteAgent({
          id: agent.uid,
          expectedRevision: agent.draft_revision ?? 1,
        }).unwrap();
      }
      selection.clearSelection();
    } finally {
      setDeletingSelected(false);
    }
  };
  const selectionTools = {
    selection,
    selectionRowIds: agents.map((agent) => String(agent.uid)),
    onDeleteSelected: () => void deleteSelected(),
    deleteDisabled: deletingSelected,
  };

  const agentCards = useMemo(() => agents, [agents]);

  if (tab === "agents" ? agentsLoadError : toolsetsLoadError)
    return (
      <QueryErrorState
        message={t("common.queryLoadError")}
        onRetry={() =>
          void (tab === "agents" ? retryAgents() : retryToolsets())
        }
      />
    );
  return (
    <VStack
      gap="24"
      max
      className={cls.page}
      data-testid="ai-agents-page-responsive"
    >
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Bot size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t("aiAgents.title")}
            </Text>
            <Text variant="muted">{t("aiAgents.subtitle")}</Text>
            <Link to="/ai-robots">
              <Text variant="muted">{t("nav.aiRobotsProduct")}</Text>
            </Link>
          </VStack>
        </HStack>
        {tab === "agents" && (
          <Button
            className={cls.createBtn}
            onClick={() => {
              setEditingAgent(null);
              setAgentModalOpen(true);
            }}
          >
            <Plus size={16} className={cls.createBtnIcon} />
            <Text as="span">{t("aiAgents.newAgent")}</Text>
          </Button>
        )}
      </Flex>

      <HStack gap="4" className={cls.tabs} role="tablist">
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={tab === "agents"}
          className={`${cls.tab} ${tab === "agents" ? cls.tabActive : ""}`}
          onClick={() => setTab("agents")}
        >
          <Bot size={16} className={cls.tabIcon} />
          <Text as="span">{t("aiAgents.tabAgents")}</Text>
          <Text as="span" className={cls.tabBadge}>
            {agents.length}
          </Text>
        </Button>
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={tab === "toolsets"}
          className={`${cls.tab} ${tab === "toolsets" ? cls.tabActive : ""}`}
          onClick={() => setTab("toolsets")}
        >
          <Wrench size={16} className={cls.tabIcon} />
          <Text as="span">{t("aiAgents.tabToolsets")}</Text>
          <Text as="span" className={cls.tabBadge}>
            {toolsets.length}
          </Text>
        </Button>
      </HStack>

      {tab === "agents" &&
        (agents.length === 0 ? (
          <EmptyState
            icon={<Bot size={48} />}
            title={t("aiAgents.empty.agents")}
            hint={t("aiAgents.empty.agentsHint")}
          />
        ) : isMobile ? (
          <VStack
            gap="8"
            max
            className={cls.mobileList}
            data-testid="hybrid-table"
            data-hybrid="mobile-card"
          >
            <TableToolbar
              {...selectionTools}
              showSearch={false}
              showExport={false}
            />
            {agentCards.map((agent) => (
              <TableCard
                onActivate={() => {
                  setEditingAgent(agent);
                  setAgentModalOpen(true);
                }}
                key={agent.uid}
                selection={selection.cardSelection(
                  String(agent.uid),
                  t("common.selectRowAria", { index: agent.name }),
                )}
                direction="column"
                className={cls.mobileCard}
                data-testid="ai-agents-mobile-card"
              >
                <HStack justify="between" align="start" max>
                  <VStack gap="4">
                    <Text as="span" className={cls.bold}>
                      {agent.name}
                    </Text>
                    <Text as="span" className={cls.uniqueId}>
                      {agent.unique_id}
                    </Text>
                    <Text
                      as="span"
                      className={`${cls.chip} ${agent.mode === "realtime" ? cls.chipRealtime : cls.chipCascade}`}
                    >
                      {agent.mode}
                    </Text>
                    <Text as="span" className={cls.cell}>
                      {providerName(agent.model_profile_id)}
                    </Text>
                  </VStack>
                </HStack>
              </TableCard>
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
            <Table className={cls.table} {...selectionTools}>
              <TableHeader>
                <TableRow>
                  <TableHead exportable={false} />
                  <TableHead>{t("aiAgents.col.name")}</TableHead>
                  <TableHead>{t("aiAgents.col.uniqueId")}</TableHead>
                  <TableHead>{t("aiAgents.col.mode")}</TableHead>
                  <TableHead>{t("aiAgents.col.model")}</TableHead>
                  <TableHead>{t("aiAgents.col.toolset")}</TableHead>
                  <TableHead>{t("aiAgents.col.enabled")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow
                    onActivate={() => {
                      setEditingAgent(agent);
                      setAgentModalOpen(true);
                    }}
                    key={agent.uid}
                    data-selected={!!selection.rowSelection[String(agent.uid)]}
                  >
                    <TableSelectionCell
                      {...selection.cardSelection(String(agent.uid))}
                      label={t("common.selectRowAria", { index: agent.name })}
                    />
                    <TableCell>
                      <VStack gap="4">
                        <Text className={cls.bold}>{agent.name}</Text>
                        {agent.greeting ? (
                          <Text variant="muted" className={cls.greeting}>
                            {agent.greeting}
                          </Text>
                        ) : null}
                      </VStack>
                    </TableCell>
                    <TableCell>
                      <Text as="span" className={cls.uniqueId}>
                        {agent.unique_id}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text
                        as="span"
                        className={`${cls.chip} ${agent.mode === "realtime" ? cls.chipRealtime : cls.chipCascade}`}
                      >
                        {agent.mode}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text as="span" className={cls.cell}>
                        {providerName(agent.model_profile_id)}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text as="span" className={cls.cell}>
                        {toolsetName(agent.toolset_id)}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        className={cls.toggleBtn}
                        onClick={() =>
                          updateAgent({
                            id: agent.uid,
                            data: { enabled: !agent.enabled },
                            expectedRevision: agent.draft_revision ?? 1,
                          })
                        }
                        title={t("aiAgents.toggleHint")}
                        aria-label={t("aiAgents.toggleHint")}
                      >
                        {agent.enabled ? (
                          <ToggleRight size={20} className={cls.toggleOn} />
                        ) : (
                          <ToggleLeft size={20} className={cls.toggleOff} />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Flex>
        ))}

      {tab === "toolsets" && (
        <EmptyState
          icon={<Wrench size={48} />}
          title={t("aiAgents.empty.toolsets")}
          hint={t("aiAgents.empty.toolsetsHint")}
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

AiAgentsPage.displayName = "AiAgentsPage";

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
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
