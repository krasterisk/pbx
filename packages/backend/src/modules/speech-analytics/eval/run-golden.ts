/**
 * Golden scoring delivery check (D-43…D-45).
 * RED stub: intentionally wrong exit policy so unit tests fail first.
 */

import * as fs from 'fs';
import * as path from 'path';
import { scoreTranscript } from '../pipeline/score';

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

function isEmptyAnswer(predicted: PredictedScores | null | undefined): boolean {
  if (predicted == null) return true;
  const keys = Object.keys(predicted).filter((k) => k !== 'summary');
  if (!keys.length) return true;
  return keys.every((k) => {
    const v = (predicted as Record<string, unknown>)[k];
    return v == null || v === '';
  });
}

/**
 * RED stub exit policy (intentionally wrong per D-45):
 * - empty model answers do NOT fail (should fail)
 * - any numeric drift fails delivery (should report only)
 */
export async function runGoldenEval(
  cases: GoldenCase[],
  deps: GoldenRunDeps,
): Promise<GoldenRunResult> {
  const items: EvalItem[] = [];
  let failures = 0;
  let journalWrites = 0;
  let chargeInvokes = 0;
  let driftDetected = false;

  for (const c of cases) {
    const predicted = await deps.scoreCase(c.transcript);
    // scoreTranscript port is the real scoring entry — keep the import live for the CLI path.
    await scoreTranscript(
      { segments: [], modelId: 'golden-eval' },
      async () => null,
    );

    if (isEmptyAnswer(predicted)) {
      failures += 1;
      continue;
    }

    const pred = predicted as PredictedScores;
    for (const key of NUMERIC_KEYS) {
      const ref = (c.reference as Record<string, unknown>)[key];
      const p = (pred as Record<string, unknown>)[key];
      if (typeof ref === 'number' && typeof p === 'number' && Math.abs(p - ref) > 0) {
        driftDetected = true;
      }
    }
    items.push({ id: c.id, reference: c.reference, predicted: pred });
  }

  const report = buildEvalReport(items);
  // WRONG: empty answers ignored; drift fails delivery
  const exitCode = driftDetected ? 1 : 0;
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
