/** Journal list columns aligned with aiPBX operator CallsTable. */

export type JournalSentiment = 'positive' | 'neutral' | 'negative';

export type JournalListColumns = {
  operatorName: string | null;
  callerPhone: string | null;
  durationMs: number | null;
  score: number | null;
  sentiment: JournalSentiment | null;
  topics: string[];
  success: boolean | null;
  lowStt: boolean;
  projectName: string | null;
};

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function metricRows(raw: unknown): Array<Record<string, unknown>> {
  if (typeof raw === 'string') {
    try {
      return metricRows(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
  }
  const record = asRecord(raw);
  if (Array.isArray(record.metrics)) return metricRows(record.metrics);
  return [];
}

function sentimentOf(value: unknown): JournalSentiment | null {
  const raw = text(value)?.toLowerCase();
  if (raw === 'positive' || raw === 'neutral' || raw === 'negative') return raw;
  return null;
}

function csatOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(text(value));
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function durationMsOf(audioMs: unknown, meta: Record<string, unknown>): number | null {
  const fromRun = Number(audioMs);
  if (Number.isFinite(fromRun) && fromRun > 0) return Math.round(fromRun);
  const fromMs = Number(meta.durationMs);
  if (Number.isFinite(fromMs) && fromMs > 0) return Math.round(fromMs);
  const fromSec = Number(meta.durationSec);
  if (Number.isFinite(fromSec) && fromSec > 0) return Math.round(fromSec * 1000);
  return null;
}

export function readJournalColumns(input: {
  metadata: unknown;
  audioMs: unknown;
  metricResults: unknown;
  quality: string | null | undefined;
  projectName: string | null;
}): JournalListColumns {
  const meta = asRecord(input.metadata);
  const operatorObject = asRecord(meta.operator);
  const operatorName = text(meta.operatorName)
    ?? text(operatorObject.name)
    ?? text(meta.operatorExten);
  const callerPhone = text(meta.clientPhone) ?? text(meta.callerId) ?? text(meta.caller);

  const topics: string[] = [];
  let score: number | null = null;
  let sentiment: JournalSentiment | null = null;
  let success: boolean | null = null;

  for (const row of metricRows(input.metricResults)) {
    const id = text(row.id)?.toLowerCase() ?? '';
    if (id === 'topic' || id === 'topics') {
      if (Array.isArray(row.value)) {
        for (const item of row.value) {
          const label = text(item);
          if (label) topics.push(label);
        }
      } else {
        const label = text(row.value);
        if (label) topics.push(label);
      }
    } else if (id === 'csat' || id === 'score') {
      score = csatOf(row.value) ?? score;
    } else if (id === 'customer_sentiment' || id === 'sentiment') {
      sentiment = sentimentOf(row.value) ?? sentiment;
    } else if (id === 'success' || id === 'scenario_success') {
      if (typeof row.value === 'boolean') success = row.value;
    }
  }

  return {
    operatorName,
    callerPhone,
    durationMs: durationMsOf(input.audioMs, meta),
    score,
    sentiment,
    topics,
    success,
    lowStt: input.quality === 'low',
    projectName: input.projectName,
  };
}
