import { memo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { VStack } from '@/shared/ui';
import type { IntradayChartPoint } from '../../lib/intradayChartData';
import styles from './IntradayChart.module.scss';

export interface IntradayChartLabels {
  /** Accessible description of the whole chart. */
  chart: string;
  answered: string;
  abandoned: string;
  shortAbandoned: string;
  sla: string;
  previousOffered: string;
}

export interface IntradayChartProps {
  points: readonly IntradayChartPoint[];
  labels: IntradayChartLabels;
  /** Draw the same interval of the previous week as a dashed line. */
  showPrevious: boolean;
}

const AXIS_TICK = { fill: 'var(--color-muted-foreground)', fontSize: 11 };

/**
 * Calls per interval (stacked: handled / abandoned / short abandoned) with the running service level
 * on a 0-100 % axis and an optional week-ago overlay. Colours are design tokens only.
 */
export const IntradayChart = memo(function IntradayChart({ points, labels, showPrevious }: IntradayChartProps) {
  return (
    <VStack role="img" aria-label={labels.chart} className={styles.chart} data-testid="intraday-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points as IntradayChartPoint[]} margin={{ left: 0, right: 4, top: 8, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" minTickGap={28} tick={AXIS_TICK} />
          <YAxis yAxisId="calls" allowDecimals={false} width={36} tick={AXIS_TICK} />
          <YAxis
            yAxisId="sla"
            orientation="right"
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            width={40}
            tickFormatter={(value: number) => `${value}%`}
            tick={AXIS_TICK}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-card)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="calls" stackId="calls" dataKey="answered" name={labels.answered} fill="var(--color-success)" isAnimationActive={false} />
          <Bar yAxisId="calls" stackId="calls" dataKey="abandoned" name={labels.abandoned} fill="var(--color-destructive)" isAnimationActive={false} />
          <Bar yAxisId="calls" stackId="calls" dataKey="shortAbandoned" name={labels.shortAbandoned} fill="var(--color-warning)" isAnimationActive={false} />
          <Line
            yAxisId="sla"
            type="monotone"
            dataKey="cumulativeSla"
            name={labels.sla}
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {showPrevious && (
            <Line
              yAxisId="calls"
              type="monotone"
              dataKey="previousOffered"
              name={labels.previousOffered}
              stroke="var(--color-muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </VStack>
  );
});
