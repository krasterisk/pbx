import { createHash } from 'node:crypto';

/** Same model and Matryoshka dim as `SemanticRouterService` in voice-robots. */
export const NOMIC_MODEL = 'nomic-ai/nomic-embed-text-v1.5';
export const NOMIC_EMBED_DIM = 256;

export type TextEmbedder = {
  model: string;
  profile: string;
  dim: number;
  embed(text: string, isQuery?: boolean): Promise<Float32Array>;
};

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i += 1) dot += a[i] * b[i];
  return dot;
}

export function normalizeVector(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i += 1) vec[i] /= norm;
  }
  return vec;
}

/** Portable exact vector for MySQL/PG TEXT blob — little-endian float32. */
export function encodeVector(vec: Float32Array): string {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i += 1) buf.writeFloatLE(vec[i], i * 4);
  return buf.toString('base64');
}

export function decodeVector(blob: string, dim = NOMIC_EMBED_DIM): Float32Array {
  const buf = Buffer.from(blob, 'base64');
  const count = Math.min(dim, Math.floor(buf.byteLength / 4));
  const values = new Float32Array(count);
  for (let i = 0; i < count; i += 1) values[i] = buf.readFloatLE(i * 4);
  return values;
}

/**
 * Token-hash bag-of-words in the same 256-dim space.
 * Used when the nomic ONNX model is not loaded (CI). Distinct tokens land in distinct bins.
 */
export function hashedBowEmbedder(dim = NOMIC_EMBED_DIM): TextEmbedder {
  return {
    model: 'hashed_bow',
    profile: 'hashed_bow_256',
    dim,
    async embed(text: string) {
      const vec = new Float32Array(dim);
      for (const term of text.toLowerCase().split(/\s+/).filter(Boolean)) {
        const digest = createHash('sha256').update(term).digest();
        vec[digest.readUInt16BE(0) % dim] += 1;
      }
      return normalizeVector(vec);
    },
  };
}

let sharedNomic: Promise<TextEmbedder | null> | null = null;

async function loadNomicEmbedder(): Promise<TextEmbedder | null> {
  try {
    const { pipeline: createPipeline } = await import('@huggingface/transformers');
    const pipeline = await createPipeline('feature-extraction', NOMIC_MODEL, {
      dtype: 'q8',
      device: 'cpu',
    });
    return {
      model: NOMIC_MODEL,
      profile: 'nomic-embed-text-v1.5',
      dim: NOMIC_EMBED_DIM,
      async embed(text: string, isQuery = true) {
        const prefixed = isQuery ? `search_query: ${text}` : `search_document: ${text}`;
        const output = await pipeline(prefixed, { pooling: 'mean', normalize: true });
        const full: Float32Array = output.data instanceof Float32Array
          ? output.data
          : new Float32Array(output.data);
        return normalizeVector(full.slice(0, NOMIC_EMBED_DIM));
      },
    };
  } catch {
    return null;
  }
}

/** Process-wide nomic embedder so knowledge and voice-robots share one ONNX load. */
export function getSharedNomicEmbedder(): Promise<TextEmbedder | null> {
  if (!sharedNomic) sharedNomic = loadNomicEmbedder();
  return sharedNomic;
}
