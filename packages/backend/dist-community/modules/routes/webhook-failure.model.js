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
exports.WebhookFailure = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Stores failed webhook deliveries after all BullMQ retry attempts exhausted.
 *
 * DDL (run once on server):
 * CREATE TABLE webhook_failures (
 *   id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 *   route_uid   VARCHAR(64)  NOT NULL,
 *   event       VARCHAR(32)  NOT NULL,
 *   url         VARCHAR(512) NOT NULL,
 *   payload     JSON         NOT NULL,
 *   headers     JSON         NOT NULL,
 *   error       TEXT,
 *   attempts    TINYINT UNSIGNED DEFAULT 3,
 *   failed_at   DATETIME DEFAULT NOW(),
 *   retried_at  DATETIME NULL,
 *   resolved    TINYINT(1) DEFAULT 0
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 */
let WebhookFailure = class WebhookFailure extends sequelize_typescript_1.Model {
};
exports.WebhookFailure = WebhookFailure;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER.UNSIGNED }),
    __metadata("design:type", Number)
], WebhookFailure.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(64), allowNull: false }),
    __metadata("design:type", String)
], WebhookFailure.prototype, "route_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false }),
    __metadata("design:type", String)
], WebhookFailure.prototype, "event", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: false }),
    __metadata("design:type", String)
], WebhookFailure.prototype, "url", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], WebhookFailure.prototype, "payload", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], WebhookFailure.prototype, "headers", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], WebhookFailure.prototype, "error", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(3),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TINYINT.UNSIGNED }),
    __metadata("design:type", Number)
], WebhookFailure.prototype, "attempts", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'failed_at', defaultValue: sequelize_typescript_1.DataType.NOW }),
    __metadata("design:type", Date)
], WebhookFailure.prototype, "failed_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'retried_at', allowNull: true }),
    __metadata("design:type", Object)
], WebhookFailure.prototype, "retried_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN }),
    __metadata("design:type", Boolean)
], WebhookFailure.prototype, "resolved", void 0);
exports.WebhookFailure = WebhookFailure = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'webhook_failures', timestamps: false, freezeTableName: true })
], WebhookFailure);
//# sourceMappingURL=webhook-failure.model.js.map