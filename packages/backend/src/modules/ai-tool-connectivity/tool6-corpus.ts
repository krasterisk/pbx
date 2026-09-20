import { lexicalRetrieve, vectorRetrieve } from '../knowledge/knowledge-engine';
import { hashedBowEmbedder } from '../embeddings/nomic-embed';

export type Tool6Chunk = { id: string; text: string; allowed: boolean; tenantUid: number };

const TOPICS = [
  'overtime-policy', 'vacation-balance', 'sick-leave', 'remote-work', 'password-reset',
  'vpn-access', 'invoice-status', 'delivery-window', 'return-period', 'warranty-claim',
  'opening-hours', 'parking-permit', 'meeting-room', 'visitor-badge', 'fire-drill',
  'salary-date', 'tax-form', 'benefits-dental', 'hardware-laptop', 'software-license',
  'shift-swap', 'on-call-rota', 'escalation-path', 'sla-priority', 'refund-policy',
  'shipping-cost', 'language-pack', 'data-retention', 'access-review', 'incident-severity',
];

export function buildTool6Corpus(): {
  items: Array<{ id: string; query: string; answerable: boolean; relevant: string[] }>;
  chunks: Tool6Chunk[];
} {
  const chunks: Tool6Chunk[] = TOPICS.map((topic, index) => ({
    id: `doc-${index + 1}`,
    text: `Handbook section ${topic} keyword ${topic}-token explains the official rule for ${topic.replace(/-/g, ' ')}.`,
    allowed: true,
    tenantUid: 8,
  }));
  chunks.push({
    id: 'doc-other-tenant',
    text: 'Handbook section overtime-policy keyword overtime-policy-token leaked',
    allowed: true,
    tenantUid: 9,
  });
  const answerable = TOPICS.map((topic, index) => ({
    id: `q-${index + 1}`,
    query: `${topic}-token`,
    answerable: true,
    relevant: [`doc-${index + 1}`],
  }));
  const unanswerable = Array.from({ length: 15 }, (_, index) => ({
    id: `u-${index + 1}`,
    query: `unanswerable-term-${index + 1}-zxq`,
    answerable: false,
    relevant: [] as string[],
  }));
  return { items: [...answerable, ...unanswerable], chunks };
}

export function retrieveTool6(query: string, chunks: Tool6Chunk[], tenantUid = 8) {
  return lexicalRetrieve(
    query,
    chunks.filter(chunk => chunk.tenantUid === tenantUid).map(chunk => ({
      id: chunk.id, text: chunk.text, allowed: chunk.allowed,
    })),
  ).map(row => ({ ...row, tenantUid }));
}

export async function retrieveTool6Vector(query: string, chunks: Tool6Chunk[], tenantUid = 8) {
  const embedder = hashedBowEmbedder();
  const scoped = chunks.filter(chunk => chunk.tenantUid === tenantUid);
  const withVectors = await Promise.all(scoped.map(async chunk => ({
    id: chunk.id,
    text: chunk.text,
    allowed: chunk.allowed,
    vector: await embedder.embed(chunk.text, false),
    tenantUid: chunk.tenantUid,
  })));
  const hits = await vectorRetrieve(query, withVectors, embedder);
  return hits.map(row => ({ ...row, tenantUid }));
}
