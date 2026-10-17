import { memo } from 'react';
import { ArrowDown, ArrowUp, HelpCircle, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Flex, HStack, Sparkline, Text, Tooltip, VStack } from '@/shared/ui';
import type { KpiDelta } from '../../lib/kpiDelta';
import styles from './CcKpiCard.module.scss';

export type CcKpiTone = 'success' | 'warning' | 'destructive' | 'default';

export interface CcKpiCardProps {
  testId: string;
  title: string;
  value: string;
  /** Colour of the value (thresholds); `default` for plain volumes. */
  tone?: CcKpiTone;
  /** Secondary line under the value (e.g. short abandons excluded). */
  note?: string;
  /** Target threshold label (e.g. "Goal ≥ 80%") shown in the header (U4.2). */
  targetText?: string;
  /** Tooltip explaining how the metric is computed (U4.2). */
  formulaHint?: string;
  delta: KpiDelta | null;
  /** Already formatted change ("+5.0 pp", "-12%"); shown only with a delta. */
  deltaText: string;
  /** Text shown when there is no comparison. */
  noComparisonText: string;
  spark: readonly number[];
  onOpen: () => void;
}

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/**
 * One KPI of the management dashboard: value, change versus the previous period and a sparkline.
 * The whole card is a button - it drills into the report.
 */
export const CcKpiCard = memo(function CcKpiCard({
  testId,
  title,
  value,
  tone = 'default',
  note,
  targetText,
  formulaHint,
  delta,
  deltaText,
  noComparisonText,
  spark,
  onOpen,
}: CcKpiCardProps) {
  const TrendIcon = delta ? TREND_ICON[delta.trend] : null;
  return (
    <Tooltip content={formulaHint}>
    <Button
      type="button"
      variant="ghost"
      className={styles.card}
      onClick={onOpen}
      data-testid={testId}
    >
      <VStack gap="4" align="start" className={styles.body}>
        <Flex align="center" justify="between" gap="6" wrap="wrap" className={styles.headRow}>
          <HStack gap="4" align="center">
            <Text as="span" variant="xs" className={styles.title}>{title}</Text>
            {formulaHint && (
                <Flex as="span" className={styles.helpIcon} data-testid={`${testId}-help`}>
                  <HelpCircle size={12} aria-hidden="true" />
                </Flex>
            )}
          </HStack>
          {targetText && (
            <Text as="span" variant="xs" className={styles.target} data-testid={`${testId}-target`}>
              {targetText}
            </Text>
          )}
        </Flex>
        <Text
          as="span"
          className={clsx(styles.value, styles[`tone_${tone}`])}
          data-testid={`${testId}-value`}
          data-tone={tone}
        >
          {value}
        </Text>
        {note && <Text as="span" variant="xs" data-testid={`${testId}-note`}>{note}</Text>}
        <Flex align="center" justify="between" gap="8" className={styles.foot}>
          {delta && TrendIcon ? (
            <Flex align="center" gap="2" className={clsx(styles.delta, styles[`delta_${delta.tone}`])} data-testid={`${testId}-delta`} data-tone={delta.tone}>
              <TrendIcon size={12} aria-hidden="true" />
              <Text as="span" variant="xs" className={styles.deltaText}>{deltaText}</Text>
            </Flex>
          ) : (
            <Text as="span" variant="xs" data-testid={`${testId}-nocompare`}>{noComparisonText}</Text>
          )}
          {spark.length > 1 && <Sparkline data={[...spark]} width={64} height={20} />}
        </Flex>
      </VStack>
    </Button>
    </Tooltip>
  );
});
