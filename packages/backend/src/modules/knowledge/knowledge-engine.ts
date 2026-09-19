import { createHash } from 'node:crypto';

export class DomainError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ? `${code}: ${message}` : code);
  }
}

const MAX_BYTES = 20 * 1024 * 1024;
const FORBIDDEN = /javascript:|https?:\/\/|oleobject|macros?/i;

export function assertKnowledgeSource(input: { mime: string; bytes: number; text: string }): void {
  if (input.bytes > MAX_BYTES) throw new DomainError('document_too_large', 400);
  if (!['text/plain', 'text/markdown', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(input.mime)) {
    throw new DomainError('source_unsupported', 400);
  }
  if (FORBIDDEN.test(input.text)) throw new DomainError('active_content_rejected', 400);
}

export function chunkText(text: string, size = 512, overlap = 64): Array<{ ordinal: number; text: string }> {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: Array<{ ordinal: number; text: string }> = [];
  let start = 0;
  let ordinal = 0;
  while (start < words.length) {
    const slice = words.slice(start, start + size);
    chunks.push({ ordinal, text: slice.join(' ') });
    ordinal += 1;
    start += Math.max(1, size - overlap);
  }
  return chunks;
}

export function lexicalRetrieve(query: string, chunks: Array<{ id: string; text: string; allowed: boolean }>) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return chunks.filter(chunk => chunk.allowed && terms.some(term => chunk.text.toLowerCase().includes(term)))
    .slice(0, 5)
    .map(chunk => ({ id: chunk.id, excerpt: chunk.text.slice(0, 240), engine: 'lexical_fallback' as const }));
}

export function manifestDigest(memberIds: string[]): string {
  return createHash('sha256').update(memberIds.slice().sort().join(',')).digest('hex');
}
