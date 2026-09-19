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
exports.IntegrationAuthLimit = exports.IntegrationCommand = exports.IntegrationAudit = exports.IntegrationGrant = exports.IntegrationCredential = exports.IntegrationPrincipal = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let IntegrationPrincipal = class IntegrationPrincipal extends sequelize_typescript_1.Model {
};
exports.IntegrationPrincipal = IntegrationPrincipal;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationPrincipal.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], IntegrationPrincipal.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(120)),
    __metadata("design:type", String)
], IntegrationPrincipal.prototype, "label", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], IntegrationPrincipal.prototype, "product", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(16)),
    __metadata("design:type", String)
], IntegrationPrincipal.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BIGINT),
    __metadata("design:type", String)
], IntegrationPrincipal.prototype, "permission_revision", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], IntegrationPrincipal.prototype, "created_by", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], IntegrationPrincipal.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], IntegrationPrincipal.prototype, "updated_at", void 0);
exports.IntegrationPrincipal = IntegrationPrincipal = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_integration_principals', timestamps: false })
], IntegrationPrincipal);
let IntegrationCredential = class IntegrationCredential extends sequelize_typescript_1.Model {
};
exports.IntegrationCredential = IntegrationCredential;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationCredential.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], IntegrationCredential.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationCredential.prototype, "principal_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(22)),
    __metadata("design:type", String)
], IntegrationCredential.prototype, "selector", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BLOB),
    __metadata("design:type", Buffer)
], IntegrationCredential.prototype, "secret_digest", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", Object)
], IntegrationCredential.prototype, "predecessor_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], IntegrationCredential.prototype, "generation", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Object)
], IntegrationCredential.prototype, "expires_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Object)
], IntegrationCredential.prototype, "revoked_at", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], IntegrationCredential.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], IntegrationCredential.prototype, "created_by", void 0);
exports.IntegrationCredential = IntegrationCredential = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_integration_credentials', timestamps: false })
], IntegrationCredential);
let IntegrationGrant = class IntegrationGrant extends sequelize_typescript_1.Model {
};
exports.IntegrationGrant = IntegrationGrant;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationGrant.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], IntegrationGrant.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationGrant.prototype, "principal_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(32)),
    __metadata("design:type", String)
], IntegrationGrant.prototype, "resource_kind", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationGrant.prototype, "resource_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], IntegrationGrant.prototype, "scope", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], IntegrationGrant.prototype, "created_at", void 0);
exports.IntegrationGrant = IntegrationGrant = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_integration_grants', timestamps: false })
], IntegrationGrant);
let IntegrationAudit = class IntegrationAudit extends sequelize_typescript_1.Model {
};
exports.IntegrationAudit = IntegrationAudit;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationAudit.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], IntegrationAudit.prototype, "tenant_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationAudit.prototype, "principal_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], IntegrationAudit.prototype, "actor_user_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(32)),
    __metadata("design:type", String)
], IntegrationAudit.prototype, "action", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationAudit.prototype, "request_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], IntegrationAudit.prototype, "metadata", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], IntegrationAudit.prototype, "created_at", void 0);
exports.IntegrationAudit = IntegrationAudit = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_integration_audit', timestamps: false })
], IntegrationAudit);
let IntegrationCommand = class IntegrationCommand extends sequelize_typescript_1.Model {
};
exports.IntegrationCommand = IntegrationCommand;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], IntegrationCommand.prototype, "tenant_uid", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], IntegrationCommand.prototype, "actor_user_id", void 0);
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationCommand.prototype, "operation_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], IntegrationCommand.prototype, "command_hash", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(36)),
    __metadata("design:type", String)
], IntegrationCommand.prototype, "principal_id", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], IntegrationCommand.prototype, "resulting_generation", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], IntegrationCommand.prototype, "completed_at", void 0);
exports.IntegrationCommand = IntegrationCommand = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_integration_commands', timestamps: false })
], IntegrationCommand);
let IntegrationAuthLimit = class IntegrationAuthLimit extends sequelize_typescript_1.Model {
};
exports.IntegrationAuthLimit = IntegrationAuthLimit;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], IntegrationAuthLimit.prototype, "key_hash", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], IntegrationAuthLimit.prototype, "attempts", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], IntegrationAuthLimit.prototype, "expires_at", void 0);
exports.IntegrationAuthLimit = IntegrationAuthLimit = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_integration_auth_limits', timestamps: false })
], IntegrationAuthLimit);
//# sourceMappingURL=integration-credential.models.js.map