export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export interface ITenant {
  id: number;
  uid: string;
  name: string;
  slug: string | null;
  owner_user_id: number;
  vpbx_user_uid: number;
  status: TenantStatus;
  trial_ends_at: string | null;
  email: string | null;
  phone: string | null;
  company_inn: string | null;
  max_extensions: number;
  max_trunks: number;
  max_queues: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ITenantStats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  cancelled: number;
}

export interface ICreateTenant {
  name: string;
  slug?: string;
  email: string;
  phone?: string;
  company_inn?: string;
  password: string;
  admin_name?: string;
  max_extensions?: number;
  max_trunks?: number;
  max_queues?: number;
  trial_days?: number;
}

export interface IUpdateTenant {
  name?: string;
  slug?: string;
  email?: string;
  phone?: string;
  company_inn?: string;
  status?: TenantStatus;
  trial_ends_at?: string;
  max_extensions?: number;
  max_trunks?: number;
  max_queues?: number;
}
