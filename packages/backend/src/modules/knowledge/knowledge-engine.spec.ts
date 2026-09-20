import { assertKnowledgeSource, chunkText, lexicalRetrieve, vectorRetrieve } from './knowledge-engine';
import { hashedBowEmbedder } from '../embeddings/nomic-embed';

describe('TOOL3 knowledge', () => {
  it('rejects active content and keeps retrieval ACL-aware', () => {
    expect(() => assertKnowledgeSource({
      mime: 'text/plain', bytes: 12, text: 'see https://evil.example',
    })).toThrow(/active_content_rejected/);
    const chunks = chunkText('alpha beta gamma delta '.repeat(40));
    expect(chunks[0].ordinal).toBe(0);
    expect(lexicalRetrieve('alpha', [
      { id: 'a', text: 'alpha allowed', allowed: true },
      { id: 'b', text: 'alpha denied', allowed: false },
    ]).map(row => row.id)).toEqual(['a']);
  });

  it('ranks allowed chunks by the shared hashed vector and hides denied rows', async () => {
    const embedder = hashedBowEmbedder();
    const rows = [
      { id: 'a', text: 'alpha allowed', allowed: true, vector: await embedder.embed('alpha allowed', false) },
      { id: 'b', text: 'alpha denied', allowed: false, vector: await embedder.embed('alpha denied', false) },
    ];
    const hits = await vectorRetrieve('alpha', rows, embedder);
    expect(hits.map(row => row.id)).toEqual(['a']);
    expect(hits[0].engine).toBe('hashed_bow_256');
  });
});
