import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import cls from './DistributionChart.module.scss';

export interface DistributionSegment { key: string; label: string; value: number; color: string }
export function DistributionChart({ segments, label, onSelect }: { segments: DistributionSegment[]; label: string; onSelect?: (key: string) => void }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return <div className={cls.distribution}>
    <div className={cls.chart} role="img" aria-label={`${label}: ${total}`}>
      <ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie data={segments} dataKey="value" nameKey="label" innerRadius="60%" outerRadius="85%" paddingAngle={2} isAnimationActive={false} onClick={entry => onSelect?.(String(entry.key))}>
          {segments.map(segment => <Cell key={segment.key} fill={segment.color} />)}
        </Pie>
        <Tooltip labelStyle={{color:'var(--color-foreground)'}} itemStyle={{color:'var(--color-foreground)'}}
          contentStyle={{background:'var(--color-card)',borderColor:'var(--color-border)',color:'var(--color-foreground)'}}/>
      </PieChart></ResponsiveContainer>
      <strong className={cls.total}>{total}</strong>
    </div>
    <ul className={cls.legend}>{segments.map(segment => <li key={segment.key}>
      <button type="button" onClick={() => onSelect?.(segment.key)} disabled={!onSelect} className={cls.item}>
        <i style={{background:segment.color}} aria-hidden="true"/><span>{segment.label}</span><strong>{segment.value}</strong><span>{total ? Math.round(segment.value / total * 100) : 0}%</span>
      </button>
    </li>)}</ul>
  </div>;
}
