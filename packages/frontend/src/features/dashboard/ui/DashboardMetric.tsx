import type { LucideIcon } from 'lucide-react';
import { Button, HStack, Text, InfoTooltip } from '@/shared/ui';
import cls from './Dashboard.module.scss';
export function DashboardMetric({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  onClick,
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  onClick: () => void;
}) {
  const displayValue = value.replace(/[\u00a0\u202f]/g, ' ');
  return (
    <HStack className={cls.metricWrap} data-tone={tone}>
      <Button
        type="button"
        variant="ghost"
        className={cls.metric}
        data-testid="dashboard-metric"
        onClick={onClick}
        aria-label={title}
      >
        <Text as="span" className={cls.metricHead}>
          <Text as="span" className={cls.metricLabel}>
            {title}
          </Text>
          {Icon && (
            <Text as="span" className={cls.metricIcon}>
              <Icon size={20} aria-hidden="true" />
            </Text>
          )}
        </Text>
        <Text
          as="span"
          className={cls.value + (value.length > 18 ? ' ' + cls.valueCompact : '')}
          data-testid="dashboard-metric-value"
        >
          {displayValue}
        </Text>
      </Button>
      {hint && (
        <HStack className={cls.metricHint}>
          <InfoTooltip text={hint} />
        </HStack>
      )}
    </HStack>
  );
}
