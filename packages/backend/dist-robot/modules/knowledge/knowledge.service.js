"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const product_access_service_1 = require("../product-access/product-access.service");
const knowledge_engine_1 = require("./knowledge-engine");
const knowledge_models_1 = require("./knowledge.models");
const node_crypto_1 = require("node:crypto");
let KnowledgeService = class KnowledgeService {
    products;
    bases;
    access;
    constructor(products, bases, access) {
        this.products = products;
        this.bases = bases;
        this.access = access;
    }
    mapError(error) {
        if (error instanceof common_1.HttpException)
            throw error;
        if (error instanceof knowledge_engine_1.DomainError)
            throw new common_1.HttpException({ code: error.code }, error.status);
        throw error;
    }
    async list(context) {
        return this.bases.findAll({ where: { tenant_uid: context.tenantUid } });
    }
    async createBase(context, name) {
        try {
            const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
            if (!access.allowed)
                throw new knowledge_engine_1.DomainError('entitlement', 403);
            return this.bases.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, name, status: 'draft', draft_revision: 1,
                created_by: Number(context.principalId) || 0, created_at: new Date(), updated_at: new Date(),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    ingestPreview(mime, text) {
        (0, knowledge_engine_1.assertKnowledgeSource)({ mime, bytes: Buffer.byteLength(text), text });
        return (0, knowledge_engine_1.chunkText)(text);
    }
    search(query, chunks) {
        return (0, knowledge_engine_1.lexicalRetrieve)(query, chunks);
    }
    async searchVector(query, chunks, embedder) {
        return (0, knowledge_engine_1.vectorRetrieve)(query, chunks, embedder);
    }
    releaseDigest(memberIds) {
        return (0, knowledge_engine_1.manifestDigest)(memberIds);
    }
    async revoke(context, baseId, principalKind, principalId) {
        try {
            const row = await this.access.findOne({
                where: { tenant_uid: context.tenantUid, base_id: baseId, principal_kind: principalKind, principal_id: principalId },
            });
            if (row)
                await row.destroy();
            return { revoked: true };
        }
        catch (error) {
            this.mapError(error);
        }
    }
};
exports.KnowledgeService = KnowledgeService;
exports.KnowledgeService = KnowledgeService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(knowledge_models_1.KbBase)),
    __param(2, (0, sequelize_1.InjectModel)(knowledge_models_1.KbAccessBinding)),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService, Object, Object])
], KnowledgeService);
//# sourceMappingURL=knowledge.service.js.map