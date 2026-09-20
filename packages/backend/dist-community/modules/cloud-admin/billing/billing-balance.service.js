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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var BillingBalanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingBalanceService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const billing_balance_model_1 = require("./models/billing-balance.model");
const billing_transaction_model_1 = require("./models/billing-transaction.model");
let BillingBalanceService = BillingBalanceService_1 = class BillingBalanceService {
    balanceModel;
    txModel;
    sequelize;
    logger = new common_1.Logger(BillingBalanceService_1.name);
    constructor(balanceModel, txModel, sequelize) {
        this.balanceModel = balanceModel;
        this.txModel = txModel;
        this.sequelize = sequelize;
    }
    // ─── Helpers ──────────────────────────────────────────────────────────────
    toResponse(b) {
        return {
            tenant_id: b.tenant_id,
            balance_kopecks: Number(b.balance_kopecks),
            balance_rub: Number(b.balance_kopecks) / 100,
            credit_limit_kopecks: Number(b.credit_limit_kopecks),
            currency: b.currency,
            is_blocked: b.is_blocked,
            updated_at: b.updated_at,
        };
    }
    txToResponse(tx) {
        return {
            id: Number(tx.id),
            tenant_id: tx.tenant_id,
            type: tx.type,
            amount_kopecks: Number(tx.amount_kopecks),
            amount_rub: Number(tx.amount_kopecks) / 100,
            balance_before: Number(tx.balance_before),
            balance_after: Number(tx.balance_after),
            description: tx.description,
            module_code: tx.module_code,
            performed_by: tx.performed_by,
            created_at: tx.created_at,
        };
    }
    // ─── Read ──────────────────────────────────────────────────────────────────
    async getBalance(tenantId) {
        let balance = await this.balanceModel.findOne({ where: { tenant_id: tenantId } });
        if (!balance) {
            // Auto-create on first access
            balance = await this.createBalance(tenantId);
        }
        return this.toResponse(balance);
    }
    async getTransactions(tenantId, limit = 50, offset = 0) {
        const { rows, count } = await this.txModel.findAndCountAll({
            where: { tenant_id: tenantId },
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });
        return { rows: rows.map((t) => this.txToResponse(t)), count };
    }
    // ─── Write ─────────────────────────────────────────────────────────────────
    /** Создаёт нулевой баланс для нового тенанта */
    async createBalance(tenantId, t) {
        const [balance] = await this.balanceModel.findOrCreate({
            where: { tenant_id: tenantId },
            defaults: {
                tenant_id: tenantId,
                balance_kopecks: 0,
                credit_limit_kopecks: 0,
                currency: 'RUB',
                is_blocked: false,
            },
            transaction: t,
        });
        this.logger.log(`Created billing balance for tenant #${tenantId}`);
        return balance;
    }
    /**
     * Атомарное пополнение баланса.
     * Использует SELECT ... FOR UPDATE (пессимистичная блокировка).
     *
     * @param tenantId   — ID тенанта
     * @param amountRub  — сумма пополнения в РУБЛЯХ (конвертируется в копейки)
     * @param performedBy — ID суперадмина
     * @param description — описание (комментарий)
     */
    async deposit(tenantId, amountRub, performedBy, description) {
        if (amountRub <= 0) {
            throw new common_1.BadRequestException('Сумма пополнения должна быть больше нуля');
        }
        const amountKopecks = Math.round(amountRub * 100);
        return await this.sequelize.transaction(async (t) => {
            // Pessimistic lock
            const balance = await this.balanceModel.findOne({
                where: { tenant_id: tenantId },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!balance) {
                throw new common_1.NotFoundException(`Баланс для тенанта #${tenantId} не найден`);
            }
            const balanceBefore = Number(balance.balance_kopecks);
            const balanceAfter = balanceBefore + amountKopecks;
            await balance.update({ balance_kopecks: balanceAfter, is_blocked: false }, { transaction: t });
            const tx = await this.txModel.create({
                tenant_id: tenantId,
                type: 'deposit',
                amount_kopecks: amountKopecks,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description: description ?? `Пополнение баланса на ${amountRub} руб.`,
                performed_by: performedBy,
            }, { transaction: t });
            this.logger.log(`Deposit: tenant #${tenantId} +${amountRub} RUB by admin #${performedBy}`);
            return {
                balance: this.toResponse(balance),
                transaction: this.txToResponse(tx),
            };
        });
    }
    /**
     * Ручное списание / корректировка (SuperAdmin).
     */
    async charge(tenantId, amountRub, performedBy, description, moduleCode, type = 'charge') {
        if (amountRub <= 0) {
            throw new common_1.BadRequestException('Сумма списания должна быть больше нуля');
        }
        const amountKopecks = Math.round(amountRub * 100);
        return await this.sequelize.transaction(async (t) => {
            const balance = await this.balanceModel.findOne({
                where: { tenant_id: tenantId },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!balance) {
                throw new common_1.NotFoundException(`Баланс для тенанта #${tenantId} не найден`);
            }
            const balanceBefore = Number(balance.balance_kopecks);
            const balanceAfter = balanceBefore - amountKopecks;
            const isBlocked = balanceAfter < 0 && Number(balance.credit_limit_kopecks) === 0;
            await balance.update({
                balance_kopecks: balanceAfter,
                is_blocked: isBlocked,
                blocked_at: isBlocked ? new Date() : balance.blocked_at,
            }, { transaction: t });
            const tx = await this.txModel.create({
                tenant_id: tenantId,
                type,
                amount_kopecks: amountKopecks,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description,
                module_code: moduleCode ?? null,
                performed_by: performedBy,
            }, { transaction: t });
            return {
                balance: this.toResponse(balance),
                transaction: this.txToResponse(tx),
            };
        });
    }
};
exports.BillingBalanceService = BillingBalanceService;
exports.BillingBalanceService = BillingBalanceService = BillingBalanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(billing_balance_model_1.BillingBalance)),
    __param(1, (0, sequelize_1.InjectModel)(billing_transaction_model_1.BillingTransaction)),
    __metadata("design:paramtypes", [Object, Object, sequelize_typescript_1.Sequelize])
], BillingBalanceService);
//# sourceMappingURL=billing-balance.service.js.map