import { memo, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

export const Sparkline = memo(function Sparkline({
  data,
  width = 40,
  height = 16,
  stroke = 'var(--color-primary)',
}: SparklineProps) {
  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data],
  );

  if (chartData.length === 0) {
    return <svg width={width} height={height} aria-hidden />;
  }

  return (
    <div style={{ width, height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
