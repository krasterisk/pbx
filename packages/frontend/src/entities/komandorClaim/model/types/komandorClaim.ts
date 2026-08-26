export type KomandorClaimStatus = 'new' | 'in_progress' | 'completed' | 'postponed' | 'impossible';
export type KomandorSentiment = 'negative' | 'neutral' | 'positive';
export type KomandorNotifyStatus = 'not_sent' | 'sent' | 'failed';

export interface IKomandorPerson {
  name: string;
  email?: string;
}

export interface IKomandorDeptMessage {
  at: string;
  author: string;
  text: string;
}

export interface IKomandorClaim {
  uid: number;
  operator_id: number | null;
  operator_name: string | null;
  request_date: string;
  call_uniqueid: string | null;
  request_number: string | null;
  store_id: number | null;
  store_code: string | null;
  store_name: string | null;
  store_address: string | null;
  directors: IKomandorPerson[] | null;
  zdf: IKomandorPerson[] | null;
  extra_recipients: IKomandorPerson[] | null;
  extra_emails: string | null;
  channel: string | null;
  topic: string | null;
  subtopic: string | null;
  description: string | null;
  contact_info: string | null;
  client_phone: string | null;
  client_email: string | null;
  sentiment: KomandorSentiment;
  department_log: IKomandorDeptMessage[] | null;
  customer_response: string | null;
  attachment_name: string | null;
  dept_attachment_name: string | null;
  request_status: KomandorClaimStatus;
  sms_status: KomandorNotifyStatus;
  email_status: KomandorNotifyStatus;
  store_email_status: KomandorNotifyStatus;
  user_uid: number;
  created_at: string;
  updated_at: string;
}

export interface IKomandorStore {
  uid: number;
  code: string | null;
  name: string;
  address: string | null;
  city: string | null;
  directors: IKomandorPerson[] | null;
  zdf: IKomandorPerson[] | null;
  is_active: number;
}

export interface IKomandorDict {
  uid: number;
  kind: 'channel' | 'topic' | 'subtopic';
  name: string;
  parent_name: string | null;
  sort_order: number;
}

export interface IKomandorClaimListResponse {
  rows: IKomandorClaim[];
  count: number;
}

export type IKomandorClaimStats = Record<KomandorClaimStatus, number>;

export const KOMANDOR_STATUS_OPTIONS: { value: KomandorClaimStatus; label: string; color: string }[] = [
  { value: 'new', label: 'Новая', color: 'blue' },
  { value: 'in_progress', label: 'В работе', color: 'amber' },
  { value: 'completed', label: 'Выполнено', color: 'green' },
  { value: 'postponed', label: 'Перенесено', color: 'orange' },
  { value: 'impossible', label: 'Невозможно', color: 'red' },
];

export const KOMANDOR_SENTIMENT_OPTIONS: { value: KomandorSentiment; label: string }[] = [
  { value: 'negative', label: 'Негатив' },
  { value: 'neutral', label: 'Нейтрально' },
  { value: 'positive', label: 'Позитив' },
];
