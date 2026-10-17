import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { CcDashboardOperators } from '@krasterisk/shared';
import { Button, Flex, Text, VStack } from '@/shared/ui';
import { formatMinSec, operatorLabel, operatorsViewState } from '../../lib/operatorsView';
import styles from './CcOperatorsPanel.module.scss';

export interface CcOperatorsPanelProps {
  operators: CcDashboardOperators;
  onOpenOperator: (agentInterface: string) => void;
}

/** Operators who differ from the median of the others: a reason to look, never a verdict. */
export const CcOperatorsPanel = memo(function CcOperatorsPanel({ operators, onOpenOperator }: CcOperatorsPanelProps) {
  const { t } = useTranslation();
  const state = operatorsViewState(operators);

  if (state === 'noData') {
    return (
      <Text variant="muted" data-testid="cc-operators-nodata">
        {t('callcenter.dashboard.operators.noData', 'Not enough operators with calls or logged-in time to compare')}
      </Text>
    );
  }
  if (state === 'allClear') {
    return (
      <Text variant="muted" data-testid="cc-operators-clear">
        {t('callcenter.dashboard.operators.allClear', 'No operator stands out from the others')}
      </Text>
    );
  }

  const medianAht = operators.medianAhtSec === null ? null : formatMinSec(operators.medianAhtSec);
  const medianPause = operators.medianPauseSharePct;

  return (
    <VStack gap="8" data-testid="cc-operators">
      <Text variant="xs" data-testid="cc-operators-medians">
        {t('callcenter.dashboard.operators.medians', 'Median of {{count}} operators: AHT {{aht}}, pauses {{pause}}', {
          count: operators.evaluated,
          aht: medianAht ?? '—',
          pause: medianPause === null ? '—' : `${medianPause}%`,
        })}
      </Text>
      {operators.outliers.map((operator, index) => {
        const highAht = operator.flags.includes('highAht');
        const highPause = operator.flags.includes('highPause');
        const name = operatorLabel(operator.agentInterface);
        return (
          <Button
            key={operator.agentInterface}
            variant="ghost"
            size="sm"
            className={styles.row}
            onClick={() => onOpenOperator(operator.agentInterface)}
            title={operator.agentInterface}
            data-testid={`cc-operators-row-${index}`}
          >
            <Flex align="center" gap="12" wrap="wrap" className={styles.row}>
              <Text as="span" className={styles.name}>{name}</Text>
              <Flex align="center" gap="12" wrap="wrap" className={styles.facts}>
                <Text as="span" variant="xs" className={clsx(styles.fact, highAht && styles.fact_flagged)} data-flagged={highAht} data-testid={`cc-operators-aht-${index}`}>
                  {t('callcenter.dashboard.operators.aht', 'AHT {{value}} ({{calls}} calls)', { value: formatMinSec(operator.ahtSec), calls: operator.callsHandled })}
                </Text>
                <Text as="span" variant="xs" className={clsx(styles.fact, highPause && styles.fact_flagged)} data-flagged={highPause} data-testid={`cc-operators-pause-${index}`}>
                  {t('callcenter.dashboard.operators.pause', 'Pauses {{value}}%', { value: operator.pauseSharePct })}
                </Text>
              </Flex>
            </Flex>
          </Button>
        );
      })}
    </VStack>
  );
});
