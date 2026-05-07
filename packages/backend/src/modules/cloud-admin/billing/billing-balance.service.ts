import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { BillingBalance } from './models/billing-balance.model';
import { BillingTransaction, TransactionType } from './models/billing-transaction.model';

export interface BalanceResponse {
  tenant_id: number;
  balance_kopecks: number;
  /** Баланс в рублях для отображения */
  balance_rub: number;
  credit_limit_kopecks: number;
  currency: string;
  is_blocked: boolean;
  updated_at: Date;
}

export interface TransactionResponse {
  id: number;
  tenant_id: number;
  type: TransactionType;
  amount_kopecks: number;
  amount_rub: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  module_code: string | null;
  performed_by: number | null;
  created_at: Date;
}

@Injectable()
export class BillingBalanceService {
  private readonly logger = new Logger(BillingBalanceService.name);

  constructor(
    @InjectModel(BillingBalance)    private readonly balanceModel: typeof BillingBalance,
    @InjectModel(BillingTransaction) private readonly txModel: typeof BillingTransaction,
    private readonly sequelize: Sequelize,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toResponse(b: BillingBalance): BalanceResponse {
    return {
      tenant_id:           b.tenant_id,
      balance_kopecks:     Number(b.balance_kopecks),
      balance_rub:         Number(b.balance_kopecks) / 100,
      credit_limit_kopecks: Number(b.credit_limit_kopecks),
      currency:            b.currency,
      is_blocked:          b.is_blocked,
      updated_at:          b.updated_at,
    };
  }

  private txToResponse(tx: BillingTransaction): TransactionResponse {
    return {
      id:              Number(tx.id),
      tenant_id:       tx.tenant_id,
      type:            tx.type,
      amount_kopecks:  Number(tx.amount_kopecks),
      amount_rub:      Number(tx.amount_kopecks) / 100,
      balance_before:  Number(tx.balance_before),
      balance_after:   Number(tx.balance_after),
      description:     tx.description,
      module_code:     tx.module_code,
      performed_by:    tx.performed_by,
      created_at:      tx.created_at,
    };
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async getBalance(tenantId: number): Promise<BalanceResponse> {
    let balance = await this.balanceModel.findOne({ where: { tenant_id: tenantId } });
    if (!balance) {
      // Auto-create on first access
      balance = await this.createBalance(tenantId);
    }
    return this.toResponse(balance);
  }

  async getTransactions(
    tenantId: number,
    limit = 50,
    offset = 0,
  ): Promise<{ rows: TransactionResponse[]; count: number }> {
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
  async createBalance(tenantId: number, t?: Transaction): Promise<BillingBalance> {
    const [balance] = await this.balanceModel.findOrCreate({
      where: { tenant_id: tenantId },
      defaults: {
        tenant_id: tenantId,
        balance_kopecks: 0,
        credit_limit_kopecks: 0,
        currency: 'RUB',
        is_blocked: false,
      } as any,
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
  async deposit(
    tenantId: number,
    amountRub: number,
    performedBy: number,
    description?: string,
  ): Promise<{ balance: BalanceResponse; transaction: TransactionResponse }> {
    if (amountRub <= 0) {
      throw new BadRequestException('Сумма пополнения должна быть больше нуля');
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
        throw new NotFoundException(`Баланс для тенанта #${tenantId} не найден`);
      }

      const balanceBefore = Number(balance.balance_kopecks);
      const balanceAfter  = balanceBefore + amountKopecks;

      await balance.update({ balance_kopecks: balanceAfter, is_blocked: false }, { transaction: t });

      const tx = await this.txModel.create({
        tenant_id:      tenantId,
        type:           'deposit',
        amount_kopecks: amountKopecks,
        balance_before: balanceBefore,
        balance_after:  balanceAfter,
        description:    description ?? `Пополнение баланса на ${amountRub} руб.`,
        performed_by:   performedBy,
      } as any, { transaction: t });

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
  async charge(
    tenantId: number,
    amountRub: number,
    performedBy: number,
    description?: string,
    moduleCode?: string,
    type: TransactionType = 'charge',
  ): Promise<{ balance: BalanceResponse; transaction: TransactionResponse }> {
    if (amountRub <= 0) {
      throw new BadRequestException('Сумма списания должна быть больше нуля');
    }
    const amountKopecks = Math.round(amountRub * 100);

    return await this.sequelize.transaction(async (t) => {
      const balance = await this.balanceModel.findOne({
        where: { tenant_id: tenantId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!balance) {
        throw new NotFoundException(`Баланс для тенанта #${tenantId} не найден`);
      }

      const balanceBefore = Number(balance.balance_kopecks);
      const balanceAfter  = balanceBefore - amountKopecks;
      const isBlocked     = balanceAfter < 0 && Number(balance.credit_limit_kopecks) === 0;

      await balance.update({
        balance_kopecks: balanceAfter,
        is_blocked:      isBlocked,
        blocked_at:      isBlocked ? new Date() : balance.blocked_at,
      }, { transaction: t });

      const tx = await this.txModel.create({
        tenant_id:      tenantId,
        type,
        amount_kopecks: amountKopecks,
        balance_before: balanceBefore,
        balance_after:  balanceAfter,
        description,
        module_code:    moduleCode ?? null,
        performed_by:   performedBy,
      } as any, { transaction: t });

      return {
        balance: this.toResponse(balance),
        transaction: this.txToResponse(tx),
      };
    });
  }
}
