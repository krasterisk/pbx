"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOMIC_EMBED_DIM = exports.NOMIC_MODEL = void 0;
exports.cosineSimilarity = cosineSimilarity;
exports.normalizeVector = normalizeVector;
exports.encodeVector = encodeVector;
exports.decodeVector = decodeVector;
exports.hashedBowEmbedder = hashedBowEmbedder;
exports.getSharedNomicEmbedder = getSharedNomicEmbedder;
const node_crypto_1 = require("node:crypto");
/** Same model and Matryoshka dim as `SemanticRouterService` in voice-robots. */
exports.NOMIC_MODEL = 'nomic-ai/nomic-embed-text-v1.5';
exports.NOMIC_EMBED_DIM = 256;
function cosineSimilarity(a, b) {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < len; i += 1)
        dot += a[i] * b[i];
    return dot;
}
function normalizeVector(vec) {
    let norm = 0;
    for (let i = 0; i < vec.length; i += 1)
        norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
        for (let i = 0; i < vec.length; i += 1)
            vec[i] /= norm;
    }
    return vec;
}
/** Portable exact vector for MySQL/PG TEXT blob — little-endian float32. */
function encodeVector(vec) {
    const buf = Buffer.alloc(vec.length * 4);
    for (let i = 0; i < vec.length; i += 1)
        buf.writeFloatLE(vec[i], i * 4);
    return buf.toString('base64');
}
function decodeVector(blob, dim = exports.NOMIC_EMBED_DIM) {
    const buf = Buffer.from(blob, 'base64');
    const count = Math.min(dim, Math.floor(buf.byteLength / 4));
    const values = new Float32Array(count);
    for (let i = 0; i < count; i += 1)
        values[i] = buf.readFloatLE(i * 4);
    return values;
}
/**
 * Token-hash bag-of-words in the same 256-dim space.
 * Used when the nomic ONNX model is not loaded (CI). Distinct tokens land in distinct bins.
 */
function hashedBowEmbedder(dim = exports.NOMIC_EMBED_DIM) {
    return {
        model: 'hashed_bow',
        profile: 'hashed_bow_256',
        dim,
        async embed(text) {
            const vec = new Float32Array(dim);
            for (const term of text.toLowerCase().split(/\s+/).filter(Boolean)) {
                const digest = (0, node_crypto_1.createHash)('sha256').update(term).digest();
                vec[digest.readUInt16BE(0) % dim] += 1;
            }
            return normalizeVector(vec);
        },
    };
}
let sharedNomic = null;
async function loadNomicEmbedder() {
    try {
        const { pipeline: createPipeline } = await Promise.resolve().then(() => __importStar(require('@huggingface/transformers')));
        const pipeline = await createPipeline('feature-extraction', exports.NOMIC_MODEL, {
            dtype: 'q8',
            device: 'cpu',
        });
        return {
            model: exports.NOMIC_MODEL,
            profile: 'nomic-embed-text-v1.5',
            dim: exports.NOMIC_EMBED_DIM,
            async embed(text, isQuery = true) {
                const prefixed = isQuery ? `search_query: ${text}` : `search_document: ${text}`;
                const output = await pipeline(prefixed, { pooling: 'mean', normalize: true });
                const full = output.data instanceof Float32Array
                    ? output.data
                    : new Float32Array(output.data);
                return normalizeVector(full.slice(0, exports.NOMIC_EMBED_DIM));
            },
        };
    }
    catch {
        return null;
    }
}
/** Process-wide nomic embedder so knowledge and voice-robots share one ONNX load. */
function getSharedNomicEmbedder() {
    if (!sharedNomic)
        sharedNomic = loadNomicEmbedder();
    return sharedNomic;
}
//# sourceMappingURL=nomic-embed.js.map