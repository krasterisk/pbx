import { memo, useMemo, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot, User, ArrowRight, Globe, PhoneForwarded,
  PhoneOff, Repeat, MessageSquare, Mic, FolderOpen, ShieldAlert, FileDown,
  Volume2, MinusCircle,
} from 'lucide-react';
import { VStack, HStack, Text, Button } from '@/shared/ui';
import { IVoiceRobotKeywordGroup, IVoiceRobotKeyword, IVoiceRobotBotAction } from '@/entities/voiceRobot';
import {
  useGetVoiceRobotKeywordGroupsQuery,
  useGetVoiceRobotKeywordsQuery,
} from '@/shared/api/endpoints/voiceRobotsApi';
import { useGetVoiceRobotDataListsQuery } from '@/shared/api/endpoints/voiceRobotDataListsApi';
import { useReactToPrint } from 'react-to-print';

interface ScenarioTreePreviewProps {
  robotId: number;
  greetingText?: string;
}

/** Wrapper that fetches keywords for a single group and renders its tree nodes */
const GroupKeywordsRenderer = memo(({ group, t, robotId }: {
  group: IVoiceRobotKeywordGroup;
  t: any;
  robotId: number;
}) => {
  const { data: keywords = [] } = useGetVoiceRobotKeywordsQuery(group.uid);

  return (
    <TreeNode
      key={group.uid}
      color={NODE_COLORS.group}
      iconColor={ICON_COLORS.group}
      icon={FolderOpen}
      indent={0}
      label={
        <HStack gap="4" align="center">
          <Text as="span">{group.name}</Text>
          <Text as="span" className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 font-mono">
            ID: {group.uid}
          </Text>
        </HStack>
      }
      sublabel={`${keywords.length} ${t('voiceRobots.preview.scenarios', 'сценариев')}`}
    >
      {keywords.map((kw) => {
        const action = kw.bot_action || { response: { type: 'none' as const }, nextState: { type: 'listen' as const } };
        const hasEscalation = (kw.max_repeats || 0) > 0 && kw.escalation_action;

        return (
          <VStack key={kw.uid} gap="2">
            <TreeNode
              color={NODE_COLORS.keyword}
              iconColor={ICON_COLORS.keyword}
              icon={User}
              indent={1}
              label={
                <HStack gap="4" align="center" className="flex-wrap">
                  <Text as="span">«{kw.keywords}»</Text>
                  {kw.synonyms?.length > 0 && (
                    <Text as="span" className="text-[10px] text-muted-foreground">
                      +{kw.synonyms.length} {t('voiceRobots.preview.synonyms', 'син.')}
                    </Text>
                  )}
                  {hasEscalation && (
                    <Text as="span" className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-medium">
                      <Repeat className="w-3 h-3 inline mr-0.5" />
                      ×{kw.max_repeats}
                    </Text>
                  )}
                </HStack>
              }
              sublabel={kw.negative_keywords?.length ? (
                <HStack align="center" gap="2" className="text-rose-500/80 mt-0.5">
                  <MinusCircle className="w-3 h-3" />
                  <Text as="span">{kw.negative_keywords.join(', ')}</Text>
                </HStack>
              ) : undefined}
            />
            <ActionSummaryNode action={action} t={t} indent={2} robotId={robotId} />
            {hasEscalation && (
              <ActionSummaryNode action={kw.escalation_action!} t={t} indent={2} isEscalation robotId={robotId} />
            )}
          </VStack>
        );
      })}

      {keywords.length === 0 && (
        <div style={{ marginLeft: 24 }} className="px-3 py-2 text-xs text-muted-foreground italic">
          {t('voiceRobots.noKeywords', 'Нет сценариев')}
        </div>
      )}
    </TreeNode>
  );
});
GroupKeywordsRenderer.displayName = 'GroupKeywordsRenderer';

/* ──────────── Style Constants ──────────── */

const NODE_COLORS = {
  greeting: 'border-primary/40 bg-primary/5',
  group: 'border-sky-500/40 bg-sky-500/5',
  keyword: 'border-emerald-500/40 bg-emerald-500/5',
  action: 'border-amber-500/40 bg-amber-500/5',
  terminal: 'border-rose-500/40 bg-rose-500/5',
  escalation: 'border-rose-500/30 bg-rose-500/5 border-dashed',
} as const;

const ICON_COLORS = {
  greeting: 'text-primary',
  group: 'text-sky-500',
  keyword: 'text-emerald-500',
  action: 'text-amber-500',
  terminal: 'text-rose-500',
  escalation: 'text-rose-400',
} as const;

/* ──────────── Helpers ──────────── */

const TreeNode = ({ color, iconColor, icon: Icon, label, sublabel, indent = 0, children }: {
  color: string;
  iconColor: string;
  icon: typeof Bot;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  indent?: number;
  children?: React.ReactNode;
}) => (
  <VStack gap="2" style={{ marginLeft: indent * 24 }}>
    <div className="print:block print:break-inside-avoid">
      <HStack align="start" gap="2" className={`px-3 py-2 rounded-lg border ${color} transition-all`}>
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
        <VStack gap="0" className="flex-1 min-w-0">
          <Text as="span" className="text-[13px] font-medium leading-snug">{label}</Text>
          {sublabel && <Text as="span" className="text-[11px] text-muted-foreground leading-snug">{sublabel}</Text>}
        </VStack>
      </HStack>
    </div>
    {children && (
      <VStack gap="2" className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-border/50" style={{ marginLeft: indent * 24 }} />
        {children}
      </VStack>
    )}
  </VStack>
);

const ActionSummaryNode = memo(({ action, t, indent, isEscalation = false, robotId }: {
  action: IVoiceRobotBotAction;
  t: any;
  indent: number;
  isEscalation?: boolean;
  robotId?: number;
}) => {
  const { data: dataLists = [] } = useGetVoiceRobotDataListsQuery(robotId ?? 0, { skip: !robotId });
  const stateIcons: Record<string, typeof Bot> = {
    listen: Mic,
    switch_group: ArrowRight,
    transfer_exten: PhoneForwarded,
    webhook: Globe,
    hangup: PhoneOff,
  };
  const stateLabels: Record<string, string> = {
    listen: t('voiceRobots.action.listen', 'Продолжить слушать'),
    switch_group: t('voiceRobots.action.switchGroup', 'Переключить группу'),
    transfer_exten: t('voiceRobots.action.transferExten', 'Перевод на номер'),
    webhook: t('voiceRobots.action.webhook', 'Webhook'),
    hangup: t('voiceRobots.action.hangup', 'Завершить звонок'),
    search_data_list: t('voiceRobots.action.searchDataList', 'Поиск по справочнику'),
  };

  const isTerminal = ['transfer_exten', 'hangup'].includes(action.nextState.type);
  const Icon = stateIcons[action.nextState.type] || ArrowRight;
  let label = stateLabels[action.nextState.type] || action.nextState.type;

  // Append data list name for search_data_list
  if (action.nextState.type === 'search_data_list') {
    const listId = action.dataListSearch?.listId;
    if (listId) {
      const listName = dataLists.find(dl => dl.uid === listId)?.name;
      label += listName ? ` «${listName}»` : ` (ID: ${listId})`;
    }
  }

  const responsePart = action.response.type === 'tts' && action.response.value
    ? `«${action.response.value.substring(0, 50)}${action.response.value.length > 50 ? '…' : ''}»`
    : action.response.type === 'prompt' && action.response.value
    ? (
      <HStack align="center" gap="2" className="inline-flex">
        <Volume2 className="w-3 h-3 text-amber-500" />
        <Text as="span">Prompt: {action.response.value}</Text>
      </HStack>
    )
    : null;

  const slotsPart = action.slots?.length
    ? `${action.slots.length} ${t('voiceRobots.preview.params', 'парам.')}`
    : null;

  const sublabel = responsePart && slotsPart ? (
    <HStack align="center" gap="2" className="inline-flex">
      {typeof responsePart === 'string' ? <Text as="span">{responsePart}</Text> : responsePart}
      <Text as="span" className="opacity-50">→</Text>
      <Text as="span">{slotsPart}</Text>
    </HStack>
  ) : responsePart ? (
    typeof responsePart === 'string' ? <Text as="span">{responsePart}</Text> : responsePart
  ) : slotsPart ? (
    <Text as="span">{slotsPart}</Text>
  ) : undefined;

  return (
    <TreeNode
      color={isEscalation ? NODE_COLORS.escalation : (isTerminal ? NODE_COLORS.terminal : NODE_COLORS.action)}
      iconColor={isEscalation ? ICON_COLORS.escalation : (isTerminal ? ICON_COLORS.terminal : ICON_COLORS.action)}
      icon={isEscalation ? ShieldAlert : Icon}
      indent={indent}
      label={
        <HStack gap="4" align="center">
          {isEscalation && <Text as="span" className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-semibold uppercase">ESC</Text>}
          <Text as="span">{label}{['webhook', 'transfer_exten', 'switch_group'].includes(action.nextState.type) && action.nextState.target ? ` → ${action.nextState.target}` : ''}</Text>
        </HStack>
      }
      sublabel={sublabel || undefined}
    />
  );
});
ActionSummaryNode.displayName = 'ActionSummaryNode';

/* ──────────── Main Component ──────────── */

/**
 * ScenarioTreePreview — visual tree showing the full dialogue algorithm.
 *
 * Renders all groups, their keywords, and action outcomes as a nested tree.
 * Escalation paths are displayed with dashed rose-colored borders.
 *
 * FSD layer: features/voiceRobots/ui
 */
export const ScenarioTreePreview = memo(({
  robotId, greetingText,
}: ScenarioTreePreviewProps) => {
  const { t } = useTranslation();

  const { data: groups = [] } = useGetVoiceRobotKeywordGroupsQuery(robotId);
  const activeGroups = useMemo(() => groups.filter(g => g.active), [groups]);
  const treeRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = useReactToPrint({
    contentRef: treeRef,
    documentTitle: t('voiceRobots.preview.treeTitle', 'Дерево сценариев') + `_ID${robotId}`,
  });
  return (
    <div ref={treeRef} className="tree-container print:p-8 print:bg-white">
      <style>{`
        @media print {
          .tree-container * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Override Krasterisk's text classes to guarantee black/dark-gray text when printing */
          .tree-container .text-foreground {
            color: black !important;
          }
          .tree-container .text-muted-foreground {
            color: #475569 !important;
          }
          /* Ensure the title is black too */
          .tree-container h1, .tree-container h2, .tree-container h3, .tree-container h4, .tree-container h5, .tree-container h6, .tree-container p {
             color: black !important;
          }
        }
      `}</style>
      <VStack gap="8" className="p-4 rounded-xl border border-border bg-muted/30 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:bg-transparent">
      {/* Title */}
      <div className="print:block print:break-inside-avoid">
        <HStack gap="4" align="center" className="pb-2 border-b border-border print:border-gray-300">
          <Bot className="w-5 h-5 text-primary" />
          <Text className="text-sm font-semibold">{t('voiceRobots.preview.treeTitle', 'Дерево сценариев')}</Text>
          <Text variant="xs" className="text-muted-foreground ml-auto">
          {t('voiceRobots.preview.groupsCount', '{{count}} групп', { count: activeGroups.length })}
        </Text>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExportPdf()}
          className="print:hidden ml-2"
        >
          <FileDown className="w-4 h-4 mr-1.5" />
          {t('voiceRobots.preview.print', 'Печать')}
        </Button>
      </HStack>
      </div>

      {/* Greeting */}
      {greetingText && (
        <TreeNode
          color={NODE_COLORS.greeting}
          iconColor={ICON_COLORS.greeting}
          icon={Bot}
          indent={0}
          label={t('voiceRobots.preview.greeting', 'Приветствие')}
          sublabel={`«${greetingText}»`}
        />
      )}

      {/* Groups — each one self-loads its keywords */}
      {activeGroups.map((group) => (
        <GroupKeywordsRenderer key={group.uid} group={group} t={t} robotId={robotId} />
      ))}

      {activeGroups.length === 0 && (
        <VStack align="center" className="py-8">
          <Text variant="muted">{t('voiceRobots.noDialogueGroups', 'Нет активных групп')}</Text>
        </VStack>
      )}
    </VStack>
    </div>
  );
});

ScenarioTreePreview.displayName = 'ScenarioTreePreview';
