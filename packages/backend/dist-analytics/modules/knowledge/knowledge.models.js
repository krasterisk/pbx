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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KbAccessBinding = exports.KbReleaseMember = exports.KbRelease = exports.KbEmbeddingRevision = exports.KbChunk = exports.KbDocumentRevision = exports.KbDocument = exports.KbBase = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let KbBase = class KbBase extends sequelize_typescript_1.Model {
};
exports.KbBase = KbBase;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbBase.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbBase.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(128)),
    __metadata("design:type", String)
], KbBase.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(32)),
    __metadata("design:type", String)
], KbBase.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbBase.prototype, "draft_revision", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbBase.prototype, "created_by", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], KbBase.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], KbBase.prototype, "updated_at", void 0);
exports.KbBase = KbBase = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_bases', timestamps: false })
], KbBase);
let KbDocument = class KbDocument extends sequelize_typescript_1.Model {
};
exports.KbDocument = KbDocument;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbDocument.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbDocument.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbDocument.prototype, "base_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbDocument.prototype, "source_asset_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.CHAR(64)),
    __metadata("design:type", String)
], KbDocument.prototype, "content_hash", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(32)),
    __metadata("design:type", String)
], KbDocument.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Object)
], KbDocument.prototype, "tombstoned_at", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], KbDocument.prototype, "created_at", void 0);
exports.KbDocument = KbDocument = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_documents', timestamps: false })
], KbDocument);
let KbDocumentRevision = class KbDocumentRevision extends sequelize_typescript_1.Model {
};
exports.KbDocumentRevision = KbDocumentRevision;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbDocumentRevision.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbDocumentRevision.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbDocumentRevision.prototype, "document_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbDocumentRevision.prototype, "revision", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.CHAR(64)),
    __metadata("design:type", String)
], KbDocumentRevision.prototype, "extract_digest", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], KbDocumentRevision.prototype, "extract_config", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], KbDocumentRevision.prototype, "created_at", void 0);
exports.KbDocumentRevision = KbDocumentRevision = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_document_revisions', timestamps: false })
], KbDocumentRevision);
let KbChunk = class KbChunk extends sequelize_typescript_1.Model {
};
exports.KbChunk = KbChunk;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbChunk.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbChunk.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbChunk.prototype, "document_revision_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbChunk.prototype, "ordinal", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], KbChunk.prototype, "text_ref", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], KbChunk.prototype, "provenance", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbChunk.prototype, "tokens", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.CHAR(64)),
    __metadata("design:type", String)
], KbChunk.prototype, "content_hash", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], KbChunk.prototype, "created_at", void 0);
exports.KbChunk = KbChunk = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_chunks', timestamps: false })
], KbChunk);
let KbEmbeddingRevision = class KbEmbeddingRevision extends sequelize_typescript_1.Model {
};
exports.KbEmbeddingRevision = KbEmbeddingRevision;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbEmbeddingRevision.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbEmbeddingRevision.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbEmbeddingRevision.prototype, "chunk_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], KbEmbeddingRevision.prototype, "profile", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbEmbeddingRevision.prototype, "dimension", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], KbEmbeddingRevision.prototype, "vector_ref", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(32)),
    __metadata("design:type", String)
], KbEmbeddingRevision.prototype, "state", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.CHAR(64)),
    __metadata("design:type", String)
], KbEmbeddingRevision.prototype, "content_hash", void 0);
exports.KbEmbeddingRevision = KbEmbeddingRevision = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_embedding_revisions', timestamps: false })
], KbEmbeddingRevision);
let KbRelease = class KbRelease extends sequelize_typescript_1.Model {
};
exports.KbRelease = KbRelease;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbRelease.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbRelease.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbRelease.prototype, "base_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbRelease.prototype, "revision", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.CHAR(64)),
    __metadata("design:type", String)
], KbRelease.prototype, "manifest_digest", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(32)),
    __metadata("design:type", String)
], KbRelease.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbRelease.prototype, "created_by", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], KbRelease.prototype, "created_at", void 0);
exports.KbRelease = KbRelease = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_releases', timestamps: false })
], KbRelease);
let KbReleaseMember = class KbReleaseMember extends sequelize_typescript_1.Model {
};
exports.KbReleaseMember = KbReleaseMember;
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbReleaseMember.prototype, "tenant_uid", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbReleaseMember.prototype, "release_id", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbReleaseMember.prototype, "document_revision_id", void 0);
exports.KbReleaseMember = KbReleaseMember = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_release_members', timestamps: false })
], KbReleaseMember);
let KbAccessBinding = class KbAccessBinding extends sequelize_typescript_1.Model {
};
exports.KbAccessBinding = KbAccessBinding;
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], KbAccessBinding.prototype, "tenant_uid", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], KbAccessBinding.prototype, "base_id", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(16)),
    __metadata("design:type", String)
], KbAccessBinding.prototype, "principal_kind", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], KbAccessBinding.prototype, "principal_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], KbAccessBinding.prototype, "permissions", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], KbAccessBinding.prototype, "revision", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], KbAccessBinding.prototype, "created_at", void 0);
exports.KbAccessBinding = KbAccessBinding = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'kb_access_bindings', timestamps: false })
], KbAccessBinding);
//# sourceMappingURL=knowledge.models.js.map