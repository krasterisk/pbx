import { assertKnowledgeSource, chunkText, lexicalRetrieve } from './knowledge-engine';

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
});
