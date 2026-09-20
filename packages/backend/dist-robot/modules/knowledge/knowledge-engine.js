"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainError = void 0;
exports.assertKnowledgeSource = assertKnowledgeSource;
exports.chunkText = chunkText;
exports.lexicalRetrieve = lexicalRetrieve;
exports.vectorRetrieve = vectorRetrieve;
exports.manifestDigest = manifestDigest;
const node_crypto_1 = require("node:crypto");
const nomic_embed_1 = require("../embeddings/nomic-embed");
class DomainError extends Error {
    code;
    status;
    constructor(code, status, message) {
        super(message ? `${code}: ${message}` : code);
        this.code = code;
        this.status = status;
    }
}
exports.DomainError = DomainError;
const MAX_BYTES = 20 * 1024 * 1024;
const FORBIDDEN = /javascript:|https?:\/\/|oleobject|macros?/i;
function assertKnowledgeSource(input) {
    if (input.bytes > MAX_BYTES)
        throw new DomainError('document_too_large', 400);
    if (!['text/plain', 'text/markdown', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(input.mime)) {
        throw new DomainError('source_unsupported', 400);
    }
    if (FORBIDDEN.test(input.text))
        throw new DomainError('active_content_rejected', 400);
}
function chunkText(text, size = 512, overlap = 64) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
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
function lexicalRetrieve(query, chunks) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return chunks.filter(chunk => chunk.allowed && terms.some(term => chunk.text.toLowerCase().includes(term)))
        .slice(0, 5)
        .map(chunk => ({ id: chunk.id, excerpt: chunk.text.slice(0, 240), engine: 'lexical_fallback' }));
}
async function vectorRetrieve(query, chunks, embedder, k = 5, minScore = 0.12) {
    const queryVec = await embedder.embed(query, true);
    const engine = embedder.profile ?? 'portable_vector';
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hashed = engine.startsWith('hashed_bow');
    return chunks
        .filter(chunk => chunk.allowed)
        .filter(chunk => !hashed || terms.some(term => chunk.text.toLowerCase().includes(term)))
        .map(chunk => ({
        id: chunk.id,
        excerpt: chunk.text.slice(0, 240),
        engine,
        score: (0, nomic_embed_1.cosineSimilarity)(queryVec, chunk.vector),
    }))
        .filter(row => row.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
}
function manifestDigest(memberIds) {
    return (0, node_crypto_1.createHash)('sha256').update(memberIds.slice().sort().join(',')).digest('hex');
}
//# sourceMappingURL=knowledge-engine.js.map