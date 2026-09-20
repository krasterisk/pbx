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
exports.VoiceRobotKeyword = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const keyword_group_model_1 = require("./keyword-group.model");
let VoiceRobotKeyword = class VoiceRobotKeyword extends sequelize_typescript_1.Model {
};
exports.VoiceRobotKeyword = VoiceRobotKeyword;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], VoiceRobotKeyword.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => keyword_group_model_1.VoiceRobotKeywordGroup),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeyword.prototype, "group_id", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => keyword_group_model_1.VoiceRobotKeywordGroup, { onDelete: 'CASCADE' }),
    __metadata("design:type", keyword_group_model_1.VoiceRobotKeywordGroup)
], VoiceRobotKeyword.prototype, "group", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: false }),
    __metadata("design:type", String)
], VoiceRobotKeyword.prototype, "keywords", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeyword.prototype, "negative_keywords", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeyword.prototype, "synonyms", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeyword.prototype, "actions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeyword.prototype, "bot_action", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeyword.prototype, "priority", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeyword.prototype, "max_repeats", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeyword.prototype, "escalation_action", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeyword.prototype, "comment", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", Object)
], VoiceRobotKeyword.prototype, "tag", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], VoiceRobotKeyword.prototype, "user_uid", void 0);
exports.VoiceRobotKeyword = VoiceRobotKeyword = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'voice_robot_keywords', timestamps: false, freezeTableName: true })
], VoiceRobotKeyword);
//# sourceMappingURL=keyword.model.js.map