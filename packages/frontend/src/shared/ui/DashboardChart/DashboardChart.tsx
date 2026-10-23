import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import cls from './DashboardChart.module.scss';
export interface DashboardChartPoint { at: string; [key: string]: string | number | null }
export interface DashboardChartSeries { key: string; label: string; color: string }
interface Props {
  points: DashboardChartPoint[];
  series: DashboardChartSeries[];
  label: string;
  formatTime: (at: string) => string;
  formatTooltip?: (at: string) => string;
  showLegend?: boolean;
  onPoint: (at: string, series: string) => void;
}
export function DashboardChart({ points, series, label, formatTime, formatTooltip = formatTime, showLegend = false, onPoint }: Props) {
  return <div className={cls.chart} role="img" aria-label={label} data-testid="dashboard-chart">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 8 }} accessibilityLayer>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="at" tickFormatter={formatTime} minTickGap={40} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} />
        <YAxis allowDecimals={false} width={42} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} />
        {showLegend && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} formatter={(value: string) => <span style={{ color:'var(--color-foreground)' }}>{value}</span>} />}
        <Tooltip labelFormatter={(value) => formatTooltip(String(value))}
          labelStyle={{ color: 'var(--color-foreground)' }} itemStyle={{ color: 'var(--color-foreground)' }}
          contentStyle={{ background: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
        {series.map((item) => <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} isAnimationActive={false}
          onClick={(entry: { at?: string; payload?: { at?: string } }) => { const at = entry.at ?? entry.payload?.at; if (at) onPoint(at, item.key); }} />)}
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
