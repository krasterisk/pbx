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
exports.BillingBalance = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Баланс тенанта.
 * Все суммы хранятся в КОПЕЙКАХ (integer) — исключает float-ошибки.
 * Для отображения: kopecks / 100.
 */
let BillingBalance = class BillingBalance extends sequelize_typescript_1.Model {
};
exports.BillingBalance = BillingBalance;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], BillingBalance.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Unique,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], BillingBalance.prototype, "tenant_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BIGINT),
    __metadata("design:type", Number)
], BillingBalance.prototype, "balance_kopecks", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BIGINT),
    __metadata("design:type", Number)
], BillingBalance.prototype, "credit_limit_kopecks", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('RUB'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(3)),
    __metadata("design:type", String)
], BillingBalance.prototype, "currency", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BillingBalance.prototype, "is_blocked", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Object)
], BillingBalance.prototype, "blocked_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(sequelize_typescript_1.DataType.NOW),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], BillingBalance.prototype, "updated_at", void 0);
exports.BillingBalance = BillingBalance = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'billing_balances', timestamps: false, updatedAt: 'updated_at' })
], BillingBalance);
//# sourceMappingURL=billing-balance.model.js.map