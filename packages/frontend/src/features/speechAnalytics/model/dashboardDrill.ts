export type DashboardSentiment = 'positive' | 'neutral' | 'negative';

export type DashboardCallMetric = {
  id: string;
  value: number;
  rationale: string;
};

export type DashboardCall = {
  id: string;
  occurredAt: string;
  dayLabel: string;
  operatorName: string | null;
  callerPhone: string | null;
  score: number | null;
  success: boolean | null;
  sentiment: DashboardSentiment | null;
  lowStt: boolean;
  latestAmount: string | null;
  currency: string | null;
  topics: string[];
  metrics: DashboardCallMetric[];
};

export type DashboardDrill =
  | { type: 'all' }
  | { type: 'lowStt' }
  | { type: 'cost' }
  | { type: 'success'; success?: boolean }
  | { type: 'sentiment'; sentiment: DashboardSentiment }
  | { type: 'day'; day: string }
  | { type: 'topic'; topic: string }
  | { type: 'operator'; operatorName: string | null }
  | { type: 'metric'; metricId: string; operatorName?: string | null }
  | { type: 'exemplars'; metricId?: string; insightType?: string; operatorName?: string | null }
  | { type: 'recordings'; recordingIds: string[] };

export function filterDashboardCalls(calls: DashboardCall[], drill: DashboardDrill): DashboardCall[] {
  return calls.filter((call) => {
    if (drill.type === 'all') return true;
    if (drill.type === 'lowStt') return call.lowStt;
    if (drill.type === 'cost') return call.latestAmount != null && call.latestAmount !== '';
    if (drill.type === 'success') {
      if (!call.lowStt && call.success != null && drill.success === undefined) return true;
      return !call.lowStt && call.success === drill.success;
    }
    if (drill.type === 'sentiment') return call.sentiment === drill.sentiment;
    if (drill.type === 'day') return call.dayLabel === drill.day;
    if (drill.type === 'topic') return call.topics.includes(drill.topic);
    if (drill.type === 'operator') return (call.operatorName?.trim() || null) === drill.operatorName;
    if (drill.type === 'exemplars') {
      return drill.metricId ? call.metrics.some((metric) => metric.id === drill.metricId) : true;
    }
    if (drill.type === 'recordings') return drill.recordingIds.includes(call.id);
    return call.metrics.some((metric) => metric.id === drill.metricId);
  });
}
