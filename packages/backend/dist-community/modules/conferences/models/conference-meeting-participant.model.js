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
exports.ConferenceMeetingParticipant = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let ConferenceMeetingParticipant = class ConferenceMeetingParticipant extends sequelize_typescript_1.Model {
};
exports.ConferenceMeetingParticipant = ConferenceMeetingParticipant;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], ConferenceMeetingParticipant.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false }),
    __metadata("design:type", Number)
], ConferenceMeetingParticipant.prototype, "meeting_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: false }),
    __metadata("design:type", String)
], ConferenceMeetingParticipant.prototype, "display_name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('owner', 'moderator', 'participant'),
        allowNull: false,
        defaultValue: 'participant',
    }),
    __metadata("design:type", String)
], ConferenceMeetingParticipant.prototype, "role", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: false }),
    __metadata("design:type", Boolean)
], ConferenceMeetingParticipant.prototype, "is_guest", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: false }),
    __metadata("design:type", Date)
], ConferenceMeetingParticipant.prototype, "joined_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, allowNull: true }),
    __metadata("design:type", Object)
], ConferenceMeetingParticipant.prototype, "left_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceMeetingParticipant.prototype, "caller_id_num", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceMeetingParticipant.prototype, "uniqueid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: true }),
    __metadata("design:type", Object)
], ConferenceMeetingParticipant.prototype, "channel", void 0);
exports.ConferenceMeetingParticipant = ConferenceMeetingParticipant = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'conference_meeting_participants',
        timestamps: false,
        freezeTableName: true,
    })
], ConferenceMeetingParticipant);
//# sourceMappingURL=conference-meeting-participant.model.js.map