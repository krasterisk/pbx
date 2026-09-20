import { cosineSimilarity, decodeVector, encodeVector, hashedBowEmbedder, NOMIC_EMBED_DIM, normalizeVector } from './nomic-embed';

describe('nomic embedding math (shared with voice-robots)', () => {
  it('normalizes, round-trips the portable blob, and ranks hashed tokens', async () => {
    const embedder = hashedBowEmbedder();
    expect(embedder.dim).toBe(NOMIC_EMBED_DIM);
    expect(embedder.model).toBe('hashed_bow');
    const a = await embedder.embed('overtime-policy-token', false);
    const b = decodeVector(encodeVector(a));
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
    const same = await embedder.embed('overtime-policy-token', true);
    expect(cosineSimilarity(a, same)).toBeGreaterThan(0.99);
    const other = await embedder.embed('unanswerable-term-1-zxq', true);
    expect(cosineSimilarity(a, other)).toBeLessThan(0.2);
    const unit = normalizeVector(new Float32Array([3, 4]));
    expect(unit[0]).toBeCloseTo(0.6, 5);
    expect(unit[1]).toBeCloseTo(0.8, 5);
  });
});
