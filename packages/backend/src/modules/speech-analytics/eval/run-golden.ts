/**
 * Golden scoring delivery check (D-43…D-45).
 * Transcript-only fixtures → scoring model path via scoreTranscript.
 * No journal rows, no SA-CHARGE-RUN. Exit non-zero only on empty/missing answers.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  scoreTranscript,
  type ScoreRequest,
  type ScoreResponse,
} from '../pipeline/score';
import type { DiarizedSegment } from '../pipeline/run-analysis';

export type SentimentLabel = 'Positive' | 'Neutral' | 'Negative';

export type GoldenReference = {
  greeting_quality?: number;
  script_compliance?: number;
  politeness_empathy?: number;
  active_listening?: number;
  objection_handling?: number;
  product_knowledge?: number;
  problem_resolution?: number;
  speech_clarity_pace?: number;
  closing_quality?: number;
  csat?: number;
  customer_sentiment?: SentimentLabel;
  success?: boolean;
};

export type PredictedScores = {
  greeting_quality?: number;
  script_compliance?: number;
  politeness_empathy?: number;
  active_listening?: number;
  objection_handling?: number;
  product_knowledge?: number;
  problem_resolution?: number;
  speech_clarity_pace?: number;
  closing_quality?: number;
  csat?: number;
  customer_sentiment?: string;
  success?: boolean;
  summary?: string;
};

export type GoldenCase = {
  id: string;
  description?: string;
  language?: string;
  transcript: string;
  reference: GoldenReference;
};

export type NumericMetricReport = { metric: string; mae: number; n: number };
export type CategoricalMetricReport = {
  metric: string;
  accuracy: number;
  kappa: number | null;
  n: number;
};

export type EvalReport = {
  casesEvaluated: number;
  numeric: NumericMetricReport[];
  categorical: CategoricalMetricReport[];
  overallMae: number | null;
  overallAccuracy: number | null;
};

export type EvalItem = {
  id: string;
  reference: GoldenReference;
  predicted: PredictedScores;
};

export type ScoreCaseFn = (transcript: string) => Promise<PredictedScores | null | undefined>;

export type GoldenRunDeps = {
  scoreCase: ScoreCaseFn;
  /** Must never be invoked by the golden path (D-43 / D-48). */
  createJournalRow?: (row: unknown) => Promise<unknown>;
  /** Must never be invoked by the golden path (D-43 / D-48). */
  invokeSaChargeRun?: (...args: unknown[]) => Promise<unknown>;
};

export type GoldenRunResult = {
  exitCode: number;
  failures: number;
  report: EvalReport;
  items: EvalItem[];
  journalWrites: number;
  chargeInvokes: number;
};

export const GOLDEN_SET_DIR = path.join(__dirname, 'golden-set');

const NUMERIC_KEYS = [
  'greeting_quality',
  'script_compliance',
  'politeness_empathy',
  'active_listening',
  'objection_handling',
  'product_knowledge',
  'problem_resolution',
  'speech_clarity_pace',
  'closing_quality',
  'csat',
] as const;

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function loadGoldenSet(dir: string = GOLDEN_SET_DIR): GoldenCase[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const cases: GoldenCase[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of entries) {
      const c = entry as GoldenCase;
      if (!c?.id || typeof c.transcript !== 'string' || !c.reference) {
        throw new Error(`Invalid golden fixture ${file}`);
      }
      cases.push(c);
    }
  }
  return cases;
}

export function meanAbsoluteError(pairs: Array<[number, number]>): number | null {
  if (!pairs.length) return null;
  const sum = pairs.reduce((acc, [p, r]) => acc + Math.abs(p - r), 0);
  return round(sum / pairs.length);
}

export function proportionAgreement<T>(pairs: Array<[T, T]>): number | null {
  if (!pairs.length) return null;
  const agree = pairs.reduce((acc, [p, r]) => acc + (p === r ? 1 : 0), 0);
  return round(agree / pairs.length);
}

export function cohensKappa(predicted: string[], reference: string[]): number | null {
  if (predicted.length !== reference.length || predicted.length === 0) return null;
  const n = predicted.length;
  const categories = Array.from(new Set([...predicted, ...reference]));
  let observedAgree = 0;
  for (let i = 0; i < n; i++) {
    if (predicted[i] === reference[i]) observedAgree++;
  }
  const po = observedAgree / n;
  let pe = 0;
  for (const c of categories) {
    const pPred = predicted.filter((x) => x === c).length / n;
    const pRef = reference.filter((x) => x === c).length / n;
    pe += pPred * pRef;
  }
  if (pe === 1) return null;
  return round((po - pe) / (1 - pe));
}

export function buildEvalReport(items: EvalItem[]): EvalReport {
  const numeric: NumericMetricReport[] = [];
  for (const key of NUMERIC_KEYS) {
    const pairs: Array<[number, number]> = [];
    for (const item of items) {
      const ref = (item.reference as Record<string, unknown>)[key];
      const pred = (item.predicted as Record<string, unknown>)[key];
      if (typeof ref === 'number' && typeof pred === 'number') {
        pairs.push([pred, ref]);
      }
    }
    const mae = meanAbsoluteError(pairs);
    if (mae != null) numeric.push({ metric: key, mae, n: pairs.length });
  }

  const categorical: CategoricalMetricReport[] = [];
  const sentimentPairs: Array<[string, string]> = [];
  for (const item of items) {
    const ref = item.reference.customer_sentiment;
    const pred = item.predicted.customer_sentiment;
    if (typeof ref === 'string' && typeof pred === 'string') {
      sentimentPairs.push([pred, ref]);
    }
  }
  if (sentimentPairs.length) {
    categorical.push({
      metric: 'customer_sentiment',
      accuracy: proportionAgreement(sentimentPairs)!,
      kappa: cohensKappa(
        sentimentPairs.map((p) => p[0]),
        sentimentPairs.map((p) => p[1]),
      ),
      n: sentimentPairs.length,
    });
  }

  const successPairs: Array<[string, string]> = [];
  for (const item of items) {
    const ref = item.reference.success;
    const pred = item.predicted.success;
    if (typeof ref === 'boolean' && typeof pred === 'boolean') {
      successPairs.push([String(pred), String(ref)]);
    }
  }
  if (successPairs.length) {
    categorical.push({
      metric: 'success',
      accuracy: proportionAgreement(successPairs)!,
      kappa: cohensKappa(
        successPairs.map((p) => p[0]),
        successPairs.map((p) => p[1]),
      ),
      n: successPairs.length,
    });
  }

  return {
    casesEvaluated: items.length,
    numeric,
    categorical,
    overallMae: numeric.length
      ? round(numeric.reduce((s, m) => s + m.mae, 0) / numeric.length)
      : null,
    overallAccuracy: categorical.length
      ? round(categorical.reduce((s, m) => s + m.accuracy, 0) / categorical.length)
      : null,
  };
}

export function isEmptyAnswer(predicted: PredictedScores | null | undefined): boolean {
  if (predicted == null) return true;
  const keys = Object.keys(predicted).filter((k) => k !== 'summary');
  if (!keys.length) return true;
  return keys.every((k) => {
    const v = (predicted as Record<string, unknown>)[k];
    return v == null || v === '';
  });
}

/** Parse "Оператор: … / Клиент: …" lines into diarized segments for the score port. */
export function transcriptToSegments(transcript: string): DiarizedSegment[] {
  const lines = transcript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const op = /^оператор\s*:/i.test(line);
    const cust = /^клиент\s*:/i.test(line);
    const text = line.replace(/^(оператор|клиент)\s*:\s*/i, '');
    return {
      id: `seg-${index + 1}`,
      ordinal: index + 1,
      startMs: index * 1000,
      endMs: (index + 1) * 1000,
      channel: op ? 1 : 0,
      speakerRole: op ? 'operator' : cust ? 'customer' : 'unknown',
      roleSource: 'llm' as const,
      text,
    };
  });
}

export function flattenScoreResponse(res: ScoreResponse): PredictedScores | null {
  if (!res) return null;
  const predicted: PredictedScores = {};
  if (typeof res.summary === 'string' && res.summary.trim()) {
    predicted.summary = res.summary;
  }
  for (const metric of res.metrics ?? []) {
    const id = String((metric as { id?: string }).id ?? '');
    const value = (metric as { value?: unknown }).value;
    if (!id) continue;
    if (id === 'customer_sentiment' && typeof value === 'string') {
      predicted.customer_sentiment = value;
    } else if (id === 'success' && typeof value === 'boolean') {
      predicted.success = value;
    } else if (typeof value === 'number') {
      (predicted as Record<string, number>)[id] = value;
    }
  }
  if (isEmptyAnswer(predicted)) return null;
  return predicted;
}

/**
 * Real scoring path: transcript → scoreTranscript(provider) → flat predicted scores.
 * Unit tests mock scoreCase; the CLI wires this helper with a live provider.
 */
export function makeScoreCaseFromProvider(
  provider: (req: ScoreRequest) => Promise<ScoreResponse | null>,
  modelId = process.env.SA_SCORE_MODEL_ID || 'speech-analytics-score',
): ScoreCaseFn {
  return async (transcript: string) => {
    const segments = transcriptToSegments(transcript);
    const res = await scoreTranscript({ segments, modelId }, provider);
    if (res == null) return null;
    return flattenScoreResponse(res);
  };
}

/**
 * Delivery exit policy (D-45):
 * - empty / missing model answer → non-zero exit
 * - score drift is reported (MAE/accuracy/kappa) and does NOT fail delivery
 * - never writes journal or invokes SA-CHARGE-RUN
 */
export async function runGoldenEval(
  cases: GoldenCase[],
  deps: GoldenRunDeps,
): Promise<GoldenRunResult> {
  const items: EvalItem[] = [];
  let failures = 0;
  const journalWrites = 0;
  const chargeInvokes = 0;

  for (const c of cases) {
    let predicted: PredictedScores | null | undefined;
    try {
      predicted = await deps.scoreCase(c.transcript);
    } catch (error) {
      failures += 1;
      console.error(`  ✗ ${c.id}: ${(error as Error).message}`);
      continue;
    }

    if (isEmptyAnswer(predicted)) {
      failures += 1;
      console.error(`  ✗ ${c.id}: empty or missing model answer`);
      continue;
    }

    items.push({ id: c.id, reference: c.reference, predicted: predicted as PredictedScores });
    console.log(`  ✓ ${c.id}`);
  }

  const report = buildEvalReport(items);
  // D-45: only empty/missing answers fail delivery; drift is informational.
  const exitCode = failures > 0 ? 2 : 0;
  return { exitCode, failures, report, items, journalWrites, chargeInvokes };
}

export function formatEvalReport(report: EvalReport, failures: number, total: number): string {
  const lines: string[] = [];
  lines.push('=== Speech Analytics Golden Eval Report ===');
  lines.push(`Cases evaluated: ${report.casesEvaluated}/${total} (failures: ${failures})`);
  lines.push(`Overall MAE (numeric, lower=better): ${report.overallMae ?? 'n/a'}`);
  lines.push(`Overall accuracy (categorical, higher=better): ${report.overallAccuracy ?? 'n/a'}`);
  lines.push('Numeric metrics (MAE):');
  for (const m of report.numeric) {
    lines.push(`  ${m.metric.padEnd(22)} MAE=${m.mae}  (n=${m.n})`);
  }
  lines.push('Categorical metrics (accuracy / kappa):');
  for (const m of report.categorical) {
    lines.push(
      `  ${m.metric.padEnd(22)} acc=${m.accuracy}  kappa=${m.kappa ?? 'n/a'}  (n=${m.n})`,
    );
  }
  return lines.join('\n');
}

/** OpenAI-compatible chat scoring provider for the delivery CLI (not used by npm test). */
export async function createHttpScoreProvider(
  req: ScoreRequest,
): Promise<ScoreResponse | null> {
  const baseUrl = process.env.SPEECH_ANALYTICS_SCORE_URL;
  const apiKey = process.env.SPEECH_ANALYTICS_SCORE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      'SPEECH_ANALYTICS_SCORE_URL and SPEECH_ANALYTICS_SCORE_API_KEY are required for eval:speech-analytics',
    );
  }
  const transcript = req.segments.map((s) => {
    const who = s.speakerRole === 'operator' ? 'Оператор' : s.speakerRole === 'customer' ? 'Клиент' : 'Unknown';
    return `${who}: ${s.text}`;
  }).join('\n');

  const body = {
    model: req.modelId,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You score call-center transcripts. Reply with JSON only: greeting_quality, script_compliance, politeness_empathy, active_listening, objection_handling, product_knowledge, problem_resolution, speech_clarity_pace, closing_quality (0|25|50|75|100), csat (1-5), customer_sentiment (Positive|Neutral|Negative), success (boolean), summary (string).',
      },
      { role: 'user', content: transcript },
    ],
  };

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content || !content.trim()) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const metrics = [
    ...NUMERIC_KEYS.map((id) => ({
      id,
      status: 'scored' as const,
      value: typeof parsed[id] === 'number' ? parsed[id] : null,
      evidence: [],
      rationale: 'golden-eval',
      rubricRevision: 'sa-metrics-v1',
    })),
    {
      id: 'customer_sentiment',
      status: 'scored' as const,
      value: typeof parsed.customer_sentiment === 'string' ? parsed.customer_sentiment : null,
      evidence: [],
      rationale: 'golden-eval',
      rubricRevision: 'sa-metrics-v1',
    },
    {
      id: 'success',
      status: 'scored' as const,
      value: typeof parsed.success === 'boolean' ? parsed.success : null,
      evidence: [],
      rationale: 'golden-eval',
      rubricRevision: 'sa-metrics-v1',
    },
  ];

  return {
    metrics: metrics as ScoreResponse['metrics'],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    providerTokens: json.usage?.total_tokens ?? 0,
    modelId: req.modelId,
  };
}

export async function main(argv: string[] = process.argv): Promise<number> {
  const outArg = argv.find((a) => a.startsWith('--out='));
  const outPath = outArg ? outArg.slice('--out='.length) : null;
  const cases = loadGoldenSet();
  if (!cases.length) {
    console.error('No golden-set fixtures found. Nothing to evaluate.');
    return 1;
  }
  console.log(`Loaded ${cases.length} golden case(s).`);

  const result = await runGoldenEval(cases, {
    scoreCase: makeScoreCaseFromProvider(createHttpScoreProvider),
  });

  console.log(`\n${formatEvalReport(result.report, result.failures, cases.length)}`);

  if (outPath) {
    const abs = path.resolve(outPath);
    fs.writeFileSync(
      abs,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          report: result.report,
          items: result.items,
          failures: result.failures,
        },
        null,
        2,
      ),
    );
    console.log(`\nReport written to ${abs}`);
  }

  return result.exitCode;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('Golden eval crashed:', error);
      process.exit(1);
    });
}
