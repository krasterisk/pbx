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
exports.CallGroup = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let CallGroup = class CallGroup extends sequelize_typescript_1.Model {
};
exports.CallGroup = CallGroup;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], CallGroup.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], CallGroup.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(8), allowNull: false }),
    __metadata("design:type", String)
], CallGroup.prototype, "exten", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('ringall', 'hunt', 'memoryhunt', 'random'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], CallGroup.prototype, "strategy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 25 }),
    __metadata("design:type", Number)
], CallGroup.prototype, "ring_time", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", Object)
], CallGroup.prototype, "external_context", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], CallGroup.prototype, "cid_prefix", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CallGroup.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'confirm_external' }),
    __metadata("design:type", Boolean)
], CallGroup.prototype, "confirmExternal", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(1), allowNull: false, defaultValue: '1', field: 'confirm_digit' }),
    __metadata("design:type", String)
], CallGroup.prototype, "confirmDigit", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'skip_busy' }),
    __metadata("design:type", Boolean)
], CallGroup.prototype, "skipBusy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true, field: 'greeting_prompt' }),
    __metadata("design:type", Object)
], CallGroup.prototype, "greetingPrompt", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true, field: 'moh_class' }),
    __metadata("design:type", Object)
], CallGroup.prototype, "mohClass", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'use_moh_instead_of_ringback' }),
    __metadata("design:type", Boolean)
], CallGroup.prototype, "useMohInsteadOfRingback", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false, defaultValue: 'tT', field: 'dial_options' }),
    __metadata("design:type", String)
], CallGroup.prototype, "dialOptions", void 0);
exports.CallGroup = CallGroup = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'call_groups', timestamps: false })
], CallGroup);
//# sourceMappingURL=call-group.model.js.map