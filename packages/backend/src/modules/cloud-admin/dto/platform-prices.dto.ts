import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BILLING_PERIODS, type BillingPeriod } from '../billing/billing-period.util';

export class PatchSubscriptionPriceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsIn(BILLING_PERIODS)
  period: BillingPeriod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalCount?: number;
}

export class PatchAiSkuPriceDto {
  @Type(() => Number)
  @IsInt()
  ownerTenantUid: number;

  @IsString()
  @MaxLength(64)
  skuCode: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMonthlyMinor: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  trialDays?: number;
}

export class InsertUsageRateDto {
  @IsIn(['speech_analytics', 'ai_voice_robots'])
  product: 'speech_analytics' | 'ai_voice_robots';

  @IsIn(['audio_ms', 'provider_tokens'])
  unit: 'audio_ms' | 'provider_tokens';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rate?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string | null;

  @IsIn(['shadow', 'local_byok'])
  moneyPolicy: 'shadow' | 'local_byok';
}
