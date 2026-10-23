import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import { Button, Flex, Text, VStack } from '@/shared/ui';
import type { IAgent, ICall, IPauseReason, IQueueStats } from '../../model/types/callCenterSchema';
import { buildAttentionItems, SLA_BREACH_MIN_SAMPLE, type AttentionItem, type AttentionKind } from '../../lib/attentionItems';
import {
  createAckEntry,
  createSnoozeEntry,
  groupAttentionItems,
  isItemSuppressed,
  readAttentionAckStore,
  writeAttentionAckStore,
} from '../../lib/attentionAck';
import type { KpiThresholds } from '../../lib/kpiThresholds';
import { formatClock } from '../../lib/liveCallTiming';
import { useAttentionSound } from '../../lib/useAttentionSound';
import { useCcAnnouncer } from '../../lib/useCcAnnouncer';
import { useNowTick } from '../../lib/useNowTick';
import styles from './AttentionFeed.module.scss';

/** Rows shown before the "show more" fold. */
export const ATTENTION_VISIBLE_ROWS = 5;

export interface AttentionFeedProps {
  agents: readonly IAgent[];
  queues: readonly IQueueStats[];
  calls: readonly ICall[];
  pauseReasons: ReadonlyArray<Pick<IPauseReason, 'name' | 'max_duration'>>;
  thresholds: KpiThresholds;
  /** `cc_settings.alert_sound_enabled`. */
  soundEnabled: boolean;
  queueLabel: (queueName: string) => string;
  onUnpause: (agentInterface: string) => void;
  onSpy: (agentInterface: string) => void;
  onOpenQueue: (queueName: string) => void;
  /** Collapse >= 4 identical agent-level alerts into a single expandable group row (U1.6). */
  groupSimilar?: boolean;
  /** Supervisor Pulse starts with two quiet links; details and actions are disclosed on demand. */
  compact?: boolean;
}

/**
 * "Needs attention" rail: exceptions sorted by severity, each with a one-click action.
 * Owns the clock subscription so a tick only re-renders this block.
 */
export const AttentionFeed = memo(function AttentionFeed({
  agents,
  queues,
  calls,
  pauseReasons,
  thresholds,
  soundEnabled,
  queueLabel,
  onUnpause,
  onSpy,
  onOpenQueue,
  groupSimilar = false,
  compact = false,
}: AttentionFeedProps) {
  const { t } = useTranslation();
  const now = useNowTick();
  const [expanded, setExpanded] = useState(false);
  const [ackVersion, setAckVersion] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<AttentionKind>>(() => new Set());

  const allItems = useMemo(
    () => buildAttentionItems({ agents, queues, calls, pauseReasons, thresholds, nowMs: now }),
    [agents, queues, calls, pauseReasons, thresholds, now],
  );
  const ackEntries = useMemo(
    () => readAttentionAckStore(0, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, ackVersion],
  );
  const items = useMemo(
    () => allItems.filter((item) => !isItemSuppressed(item, ackEntries, now)),
    [allItems, ackEntries, now],
  );
  useAttentionSound(items, soundEnabled);
  const { assertive } = useCcAnnouncer();
  const seenCriticalRef = useRef<Set<string> | null>(null);

  const criticalCount = items.filter((i) => i.severity === 'critical').length;
  const rows = useMemo(
    () =>
      groupSimilar
        ? groupAttentionItems(items, expandedGroups)
        : items.map((item) => ({
            type: 'single' as const,
            id: item.id,
            kind: item.kind,
            severity: item.severity,
            item,
            items: [item],
          })),
    [groupSimilar, items, expandedGroups],
  );
  const visible = expanded ? rows : rows.slice(0, ATTENTION_VISIBLE_ROWS);
  const hidden = rows.length - visible.length;

  const handleAck = (item: AttentionItem) => {
    const next = { ...ackEntries, [item.id]: createAckEntry(item) };
    writeAttentionAckStore(0, now, next);
    setAckVersion((v) => v + 1);
  };

  const handleSnooze = (item: AttentionItem) => {
    const next = { ...ackEntries, [item.id]: createSnoozeEntry(item, now) };
    writeAttentionAckStore(0, now, next);
    setAckVersion((v) => v + 1);
  };

  const describe = (item: AttentionItem): string => {
    const queue = item.queue ? queueLabel(item.queue) : '';
    const agent = item.agentName ?? '';
    const value = formatClock(item.valueSec ?? 0);
    const limit = formatClock(item.limitSec ?? 0);
    switch (item.kind) {
      case 'queue_wait':
        return t('callcenter.supervisor.attention.queueWait', {
          defaultValue: 'Queue {{queue}}: caller waiting {{value}} (limit {{limit}})', queue, value, limit,
        });
      case 'queue_sla':
        return t('callcenter.supervisor.attention.queueSla', {
          defaultValue: 'Queue {{queue}}: SLA {{value}}% (threshold {{limit}}%)',
          queue, value: Math.round(item.valuePct ?? 0), limit: item.limitPct ?? 0,
        });
      case 'agents_low':
        return t('callcenter.supervisor.attention.agentsLow', {
          defaultValue: 'Free agents: {{count}} (minimum {{limit}})',
          count: item.count ?? 0, limit: thresholds.agentsAvailableMin,
        });
      case 'pause_over':
        return t('callcenter.supervisor.attention.pauseOver', {
          defaultValue: '{{agent}}: on pause {{value}} (limit {{limit}})', agent, value, limit,
        });
      case 'wrapup_over':
        return t('callcenter.supervisor.attention.wrapupOver', {
          defaultValue: '{{agent}}: wrap-up {{value}} (limit {{limit}})', agent, value, limit,
        });
      case 'queues_detached':
        return t('callcenter.supervisor.attention.queuesDetached', {
          defaultValue: '{{agent}}: outside the queues', agent,
        });
      case 'long_talk':
        return t('callcenter.supervisor.attention.longTalk', {
          defaultValue: '{{agent}}: conversation {{value}} (normal up to {{limit}})', agent, value, limit,
        });
      default:
        return item.id;
    }
  };

  useEffect(() => {
    const currentCritical = items.filter((i) => i.severity === 'critical');
    if (seenCriticalRef.current === null) {
      seenCriticalRef.current = new Set(currentCritical.map((i) => i.id));
      return;
    }
    const newlyCritical = currentCritical.filter((i) => !seenCriticalRef.current?.has(i.id));
    seenCriticalRef.current = new Set(currentCritical.map((i) => i.id));
    if (newlyCritical.length > 0) {
      assertive(describe(newlyCritical[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, assertive]);

  const renderAction = (item: AttentionItem) => {
    switch (item.kind) {
      case 'queue_wait':
      case 'queue_sla':
        return item.queue ? (
          <Button size="sm" variant="outline" onClick={() => onOpenQueue(item.queue as string)}>
            {t('callcenter.supervisor.attention.openQueue', 'Open queue')}
          </Button>
        ) : null;
      case 'pause_over':
        return item.agentInterface ? (
          <Button size="sm" variant="outline" onClick={() => onUnpause(item.agentInterface as string)}>
            {t('callcenter.supervisor.attention.unpause', 'Resume')}
          </Button>
        ) : null;
      case 'long_talk':
        return item.agentInterface ? (
          <Button size="sm" variant="outline" onClick={() => onSpy(item.agentInterface as string)}>
            {t('callcenter.supervisor.attention.spy', 'Listen')}
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  if (items.length === 0) {
    const sample = queues.reduce((sum, q) => sum + Math.max(0, (q.calls?.total ?? 0) - (q.calls?.shortAbandoned ?? 0)), 0);
    return (
      <Flex align="center" gap="8" className={clsx(styles.feed, styles.calm, compact && styles.compact)} data-testid="attention-feed" data-state="ok">
        <CheckCircle2 className={styles.calmIcon} aria-hidden />
        <Text variant="muted">{sample < SLA_BREACH_MIN_SAMPLE
          ? t('callcenter.supervisor.attention.smallSample', 'No alerts · too few calls to assess SLA ({{count}})', { count: sample })
          : t('callcenter.supervisor.attention.allClear', 'No alerts')}</Text>
      </Flex>
    );
  }

  if (compact && !expanded) {
    return <Flex align="center" gap="12" wrap="wrap" className={styles.compact} data-testid="attention-feed"
      data-state={criticalCount > 0 ? 'critical' : 'warning'}>
      <AlertTriangle size={15} className={styles.compactIcon} aria-hidden />
      {items.slice(0, 2).map(item => <Button key={item.id} type="button" variant="unstyled" size="none"
        className={styles.compactLink} onClick={() => setExpanded(true)}>{describe(item)}</Button>)}
      {items.length > 2 && <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(true)}>
        {t('callcenter.supervisor.pulse.allAttention', { count: items.length })}
      </Button>}
    </Flex>;
  }

  return (
    <VStack gap="8" className={styles.feed} data-testid="attention-feed" data-state={criticalCount > 0 ? 'critical' : 'warning'}>
      <Flex align="center" gap="8">
        <Text variant="large">{t('callcenter.supervisor.attention.title', 'Needs attention')}</Text>
        <Text as="span" variant="small" className={styles.count} data-testid="attention-count">
          {items.length}
        </Text>
        {compact && <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>
          {t('callcenter.supervisor.pulse.collapseAttention')}
        </Button>}
      </Flex>

      <VStack gap="4" role="list" className={styles.list}>
        {visible.map((row) => {
          if (row.type === 'group') {
            return (
              <Flex
                role="listitem"
                key={row.id}
                align="center"
                justify="between"
                gap="8"
                wrap="wrap"
                className={clsx(styles.row, row.severity === 'critical' ? styles.critical : styles.warning)}
                data-testid={`attention-group-${row.kind}`}
                data-severity={row.severity}
              >
                <Flex align="center" gap="8" className={styles.message}>
                  {row.severity === 'critical'
                    ? <OctagonAlert className={styles.icon} aria-hidden />
                    : <AlertTriangle className={styles.icon} aria-hidden />}
                  <Text variant="small">
                    {t('callcenter.supervisor.attention.groupCount', {
                      defaultValue: '{{kind}}: {{count}} operators',
                      kind: row.kind,
                      count: row.items.length,
                    })}
                  </Text>
                </Flex>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setExpandedGroups((prev) => {
                      const next = new Set(prev);
                      next.add(row.kind);
                      return next;
                    })
                  }
                  data-testid={`attention-group-expand-${row.kind}`}
                >
                  {t('callcenter.supervisor.attention.expandGroup', {
                    defaultValue: 'Expand ({{count}})',
                    count: row.items.length,
                  })}
                </Button>
              </Flex>
            );
          }
          const item = row.item!;
          return (
            <Flex
              role="listitem"
              key={item.id}
              align="center"
              justify="between"
              gap="8"
              wrap="wrap"
              className={clsx(styles.row, item.severity === 'critical' ? styles.critical : styles.warning)}
              data-testid={`attention-item-${item.id}`}
              data-severity={item.severity}
            >
              <Flex align="center" gap="8" className={styles.message}>
                {item.severity === 'critical'
                  ? <OctagonAlert className={styles.icon} aria-hidden />
                  : <AlertTriangle className={styles.icon} aria-hidden />}
                <Text variant="small">{describe(item)}</Text>
              </Flex>
              <Flex align="center" gap="6" wrap="wrap">
                {renderAction(item)}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAck(item)}
                  data-testid={`attention-ack-${item.id}`}
                >
                  {t('callcenter.supervisor.attention.ack', 'Acknowledge')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSnooze(item)}
                  data-testid={`attention-snooze-${item.id}`}
                >
                  {t('callcenter.supervisor.attention.snooze10m', 'Snooze 10m')}
                </Button>
              </Flex>
            </Flex>
          );
        })}
      </VStack>

      {(hidden > 0 || expanded) && rows.length > ATTENTION_VISIBLE_ROWS && (
        <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)} data-testid="attention-toggle">
          {expanded
            ? t('callcenter.supervisor.attention.less', 'Show less')
            : t('callcenter.supervisor.attention.more', { defaultValue: 'Show {{count}} more', count: hidden })}
        </Button>
      )}
    </VStack>
  );
});
