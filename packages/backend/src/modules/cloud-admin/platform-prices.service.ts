import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ModuleRegistry } from './module-registry.model';
import { SkuCatalogService } from '../product-access/sku-catalog.service';
import {
  isBillingPeriod,
  listPriceRub,
  normalizeIntervalCount,
  type BillingPeriod,
} from './billing/billing-period.util';
import type {
  InsertUsageRateDto,
  PatchAiSkuPriceDto,
  PatchSubscriptionPriceDto,
} from './dto/platform-prices.dto';

export interface PlatformSubscriptionPrice {
  code: string;
  name: string;
  category: string;
  isCore: boolean;
  isPaid: boolean;
  isPublished: boolean;
  amount: number;
  period: BillingPeriod;
  intervalCount: number;
}

@Injectable()
export class PlatformPricesService {
  constructor(
    @InjectModel(ModuleRegistry) private readonly registry: typeof ModuleRegistry,
    private readonly skuCatalog: SkuCatalogService,
  ) {}

  async list() {
    const rows = await this.registry.findAll({
      order: [['category', 'ASC'], ['name', 'ASC']],
    });
    const [aiSkus, usageRates] = await Promise.all([
      this.skuCatalog.listAllOffers(),
      this.skuCatalog.listLatestUsageRates(),
    ]);
    return {
      subscriptions: rows.map((row) => this.toSubscription(row)),
      aiSkus,
      usageRates,
    };
  }

  async patchSubscription(code: string, dto: PatchSubscriptionPriceDto): Promise<PlatformSubscriptionPrice> {
    const row = await this.registry.findOne({ where: { code } });
    if (!row) throw new NotFoundException(`Unknown module: ${code}`);
    if (!isBillingPeriod(dto.period)) {
      throw new BadRequestException({ code: 'INVALID_BILLING_PERIOD' });
    }
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException({ code: 'INVALID_PRICE_AMOUNT' });
    }
    const intervalCount = normalizeIntervalCount(dto.intervalCount);
    const patch: Partial<ModuleRegistry> = {
      price_amount: amount,
      billing_period: dto.period,
      billing_interval_count: intervalCount,
    };
    if (dto.period === 'month' && intervalCount === 1) {
      patch.price_monthly = amount;
    }
    await row.update(patch);
    return this.toSubscription(row);
  }

  async patchAiSku(dto: PatchAiSkuPriceDto) {
    const offers = await this.skuCatalog.listAllOffers();
    const current = offers.find(
      (row) => row.ownerTenantUid === dto.ownerTenantUid && row.skuCode === dto.skuCode,
    );
    return this.skuCatalog.revise({
      ownerTenantUid: dto.ownerTenantUid,
      skuCode: dto.skuCode,
      priceMonthlyMinor: dto.priceMonthlyMinor,
      currency: dto.currency ?? current?.currency ?? 'RUB',
      trialDays: dto.trialDays ?? current?.trialDays ?? 0,
    });
  }

  async insertUsageRate(dto: InsertUsageRateDto) {
    return this.skuCatalog.insertUsageRate({
      product: dto.product,
      unit: dto.unit,
      rate: dto.rate,
      currency: dto.currency,
      moneyPolicy: dto.moneyPolicy,
    });
  }

  private toSubscription(row: ModuleRegistry): PlatformSubscriptionPrice {
    return {
      code: row.code,
      name: row.name,
      category: row.category,
      isCore: !!row.is_core,
      isPaid: !!row.is_paid,
      isPublished: !!row.is_published,
      amount: listPriceRub(row),
      period: isBillingPeriod(row.billing_period) ? row.billing_period : 'month',
      intervalCount: normalizeIntervalCount(row.billing_interval_count),
    };
  }
}
