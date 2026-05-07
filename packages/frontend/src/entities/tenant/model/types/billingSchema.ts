export interface IBillingBalance {
  tenant_id: number;
  balance_kopecks: number;
  balance_rub: number;
  credit_limit_kopecks: number;
  currency: string;
  is_blocked: boolean;
  updated_at: string;
}

export type TransactionType = 'deposit' | 'charge' | 'refund' | 'correction';

export interface IBillingTransaction {
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
  created_at: string;
}

export interface IDepositRequest {
  amountRub: number;
  description?: string;
}
