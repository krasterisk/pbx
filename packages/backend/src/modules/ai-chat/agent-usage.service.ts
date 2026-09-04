import { Injectable } from '@nestjs/common';

export interface TenantUsageRow {
  tenantUid: number;
  tokensIn: number;
  tokensOut: number;
  turns: number;
  spendUsd: number | null;
  spendAvailable: boolean;
}

/**
 * Per-tenant agent usage and spend (D-08). Implemented in 15-24 Task 1.
 */
@Injectable()
export class AgentUsageService {
  constructor(..._args: unknown[]) {}

  async queryTenantUsage(_from: Date, _to: Date): Promise<TenantUsageRow[]> {
    throw new Error('not implemented');
  }
}
