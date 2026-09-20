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
exports.VoiceRobotKeywordGroup = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const voice_robot_model_1 = require("./voice-robot.model");
let VoiceRobotKeywordGroup = class VoiceRobotKeywordGroup extends sequelize_typescript_1.Model {
};
exports.VoiceRobotKeywordGroup = VoiceRobotKeywordGroup;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], VoiceRobotKeywordGroup.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => voice_robot_model_1.VoiceRobot),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeywordGroup.prototype, "robot_id", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => voice_robot_model_1.VoiceRobot, { onDelete: 'CASCADE' }),
    __metadata("design:type", voice_robot_model_1.VoiceRobot)
], VoiceRobotKeywordGroup.prototype, "robot", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], VoiceRobotKeywordGroup.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeywordGroup.prototype, "description", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeywordGroup.prototype, "priority", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(1),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TINYINT, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeywordGroup.prototype, "active", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TINYINT, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeywordGroup.prototype, "is_global", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeywordGroup.prototype, "user_uid", void 0);
exports.VoiceRobotKeywordGroup = VoiceRobotKeywordGroup = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'voice_robot_keyword_groups', timestamps: false, freezeTableName: true })
], VoiceRobotKeywordGroup);
//# sourceMappingURL=keyword-group.model.js.map