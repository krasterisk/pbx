/**
 * Service Request (Обращение) — frontend type mirror of backend model.
 */

export type CounterpartyType = 'individual' | 'legal';
export type SmsStatus = 'not_sent' | 'sent' | 'delivered' | 'failed';
export type RequestStatus = 'new' | 'in_progress' | 'completed' | 'postponed' | 'impossible';

export interface IServiceRequest {
  uid: number;

  // Оператор и звонок
  operator_id: number | null;
  operator_name: string | null;
  call_received_at: string;
  call_uniqueid: string | null;
  request_number: string | null;

  // Контрагент
  counterparty_type: CounterpartyType;
  counterparty_name: string | null;
  account_or_inn: string | null;
  phone: string | null;

  // Адрес и территория
  territorial_zone: string | null;
  locality: string | null;
  district: string | null;
  address: string | null;

  // Суть обращения
  topic: string | null;
  comment: string | null;

  // Исполнение
  schedule_comment: string | null;
  sms_status: SmsStatus;
  scheduled_date: string | null;
  request_status: RequestStatus;

  // Мета
  user_uid: number;
  created_at: string;
  updated_at: string;
}

/** Paginated response from GET /service-requests */
export interface IServiceRequestListResponse {
  rows: IServiceRequest[];
  count: number;
}

/** Status stats from GET /service-requests/stats */
export type IServiceRequestStats = Record<RequestStatus, number>;

// ─── Constants ───────────────────────────────────────────

export const REQUEST_STATUS_OPTIONS: { value: RequestStatus; labelKey: string; fallback: string; color: string }[] = [
  { value: 'new', labelKey: 'serviceRequests.status.new', fallback: 'Новая', color: 'blue' },
  { value: 'in_progress', labelKey: 'serviceRequests.status.inProgress', fallback: 'В работе', color: 'amber' },
  { value: 'completed', labelKey: 'serviceRequests.status.completed', fallback: 'Выполнено', color: 'green' },
  { value: 'postponed', labelKey: 'serviceRequests.status.postponed', fallback: 'Перенесено', color: 'orange' },
  { value: 'impossible', labelKey: 'serviceRequests.status.impossible', fallback: 'Невозможно выполнить', color: 'red' },
];

export const SMS_STATUS_OPTIONS: { value: SmsStatus; labelKey: string; fallback: string }[] = [
  { value: 'not_sent', labelKey: 'serviceRequests.sms.notSent', fallback: 'Не отправлено' },
  { value: 'sent', labelKey: 'serviceRequests.sms.sent', fallback: 'Отправлено' },
  { value: 'delivered', labelKey: 'serviceRequests.sms.delivered', fallback: 'Доставлено' },
  { value: 'failed', labelKey: 'serviceRequests.sms.failed', fallback: 'Ошибка' },
];

export const COUNTERPARTY_TYPE_OPTIONS: { value: CounterpartyType; labelKey: string; fallback: string }[] = [
  { value: 'individual', labelKey: 'serviceRequests.counterparty.individual', fallback: 'Физ. лицо' },
  { value: 'legal', labelKey: 'serviceRequests.counterparty.legal', fallback: 'Юр. лицо' },
];
