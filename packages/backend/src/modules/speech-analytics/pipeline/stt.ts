/** STT adapter port — real provider call lands behind deps (D-23, D-38). */

export type SttRequest = {
  audioPath: string;
  modelId: string;
};

export type SttSegment = {
  start: number;
  end: number;
  text: string;
};

export type SttResponse = {
  text: string;
  durationSec: number;
  segments: SttSegment[];
  providerTokens: number;
  modelId: string;
};

/**
 * Placeholder for Nest-wired STT providers. Pipeline injects a concrete `stt` dep;
 * this module must never re-export or call the eval-only fixture synthesizer.
 */
export async function transcribeAudio(
  _req: SttRequest,
  provider: (req: SttRequest) => Promise<SttResponse | null>,
): Promise<SttResponse | null> {
  return provider(_req);
}
