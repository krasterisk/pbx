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
exports.AcCampaign = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const ac_base_model_1 = require("./ac-base.model");
let AcCampaign = class AcCampaign extends sequelize_typescript_1.Model {
};
exports.AcCampaign = AcCampaign;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], AcCampaign.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], AcCampaign.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], AcCampaign.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('draft'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], AcCampaign.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('progressive'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], AcCampaign.prototype, "dial_mode", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => ac_base_model_1.AcBase),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcCampaign.prototype, "base_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], AcCampaign.prototype, "pacing", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], AcCampaign.prototype, "retry", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], AcCampaign.prototype, "trunk_pool", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], AcCampaign.prototype, "cid_policy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], AcCampaign.prototype, "queue_names", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], AcCampaign.prototype, "scenario_actions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], AcCampaign.prototype, "amd", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(15),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcCampaign.prototype, "success_min_sec", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(45),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcCampaign.prototype, "dial_timeout_sec", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcCampaign.prototype, "revision", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], AcCampaign.prototype, "created_at", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], AcCampaign.prototype, "updated_at", void 0);
exports.AcCampaign = AcCampaign = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'ac_campaigns',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        freezeTableName: true,
    })
], AcCampaign);
//# sourceMappingURL=ac-campaign.model.js.map