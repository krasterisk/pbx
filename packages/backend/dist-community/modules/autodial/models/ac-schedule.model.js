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
exports.AcSchedule = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const ac_campaign_model_1 = require("./ac-campaign.model");
let AcSchedule = class AcSchedule extends sequelize_typescript_1.Model {
};
exports.AcSchedule = AcSchedule;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], AcSchedule.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => ac_campaign_model_1.AcCampaign),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], AcSchedule.prototype, "campaign_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('weekly'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(16), allowNull: false }),
    __metadata("design:type", String)
], AcSchedule.prototype, "kind", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TINYINT, allowNull: true }),
    __metadata("design:type", Object)
], AcSchedule.prototype, "weekday", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('09:00'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(5), allowNull: false }),
    __metadata("design:type", String)
], AcSchedule.prototype, "time_from", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('21:00'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(5), allowNull: false }),
    __metadata("design:type", String)
], AcSchedule.prototype, "time_to", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('Europe/Moscow'),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], AcSchedule.prototype, "timezone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATEONLY, allowNull: true }),
    __metadata("design:type", Object)
], AcSchedule.prototype, "date_from", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATEONLY, allowNull: true }),
    __metadata("design:type", Object)
], AcSchedule.prototype, "date_to", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(true),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false }),
    __metadata("design:type", Boolean)
], AcSchedule.prototype, "enabled", void 0);
exports.AcSchedule = AcSchedule = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'ac_schedules',
        timestamps: false,
        freezeTableName: true,
    })
], AcSchedule);
//# sourceMappingURL=ac-schedule.model.js.map