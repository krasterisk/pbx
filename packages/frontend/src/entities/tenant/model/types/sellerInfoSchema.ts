/** Billing seller (supplier) for invoices / acts. */
export interface IBillingSeller {
  id: number;
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  address: string;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  corrAccount: string;
  serviceDescription: string;
  serviceCode: string;
  isDefault: boolean;
  created_at?: string;
  updated_at?: string;
}

/** @deprecated use IBillingSeller */
export type ISellerInfo = Omit<IBillingSeller, 'id' | 'isDefault' | 'created_at' | 'updated_at'>;

export type ICreateBillingSeller = Omit<IBillingSeller, 'id' | 'created_at' | 'updated_at'>;
export type IUpdateBillingSeller = Partial<ICreateBillingSeller>;
