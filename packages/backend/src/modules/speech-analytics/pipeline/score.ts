/** Scoring adapter port — bounded metric JSON against published rubric (D-38, T-18-04-PROMPT). */

import type { SaMetricResult } from '@krasterisk/shared';
import type { DiarizedSegment } from './run-analysis';

export type ScoreRequest = {
  segments: DiarizedSegment[];
  modelId: string;
};

export type ScoreResponse = {
  metrics: SaMetricResult[];
  summary: string;
  providerTokens: number;
  modelId: string;
};

/**
 * Placeholder for Nest-wired scoring LLM. Pipeline injects a concrete `score` dep.
 * Evidence must reference transcript segment ids (validateResult pattern).
 */
export async function scoreTranscript(
  req: ScoreRequest,
  provider: (req: ScoreRequest) => Promise<ScoreResponse | null>,
): Promise<ScoreResponse | null> {
  return provider(req);
}
