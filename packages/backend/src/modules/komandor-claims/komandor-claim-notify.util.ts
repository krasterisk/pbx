import type {
  KomandorClaimStatus,
  KomandorPerson,
  KomandorSentiment,
} from './komandor-claim.model';

export const KOMANDOR_SENTIMENT_LABELS: Record<KomandorSentiment, string> = {
  negative: 'Негатив',
  neutral: 'Нейтрально',
  positive: 'Позитив',
};

export const KOMANDOR_STATUS_LABELS: Record<KomandorClaimStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  completed: 'Выполнено',
  postponed: 'Перенесено',
  impossible: 'Невозможно',
};

export function komandorSentimentLabel(value?: string | null): string {
  if (!value) return '—';
  return KOMANDOR_SENTIMENT_LABELS[value as KomandorSentiment] ?? value;
}

export function komandorStatusLabel(value?: string | null): string {
  if (!value) return '—';
  return KOMANDOR_STATUS_LABELS[value as KomandorClaimStatus] ?? value;
}

export function formatKomandorClaimDate(value?: Date | string | null): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}.${m}.${y}`;
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${dt.getFullYear()}`;
}

function peopleLabel(people?: KomandorPerson[] | null): string {
  if (!Array.isArray(people) || !people.length) return '—';
  return people
    .map((p) => [p.name, p.email].filter(Boolean).join(' <') + (p.email ? '>' : ''))
    .join(', ');
}

export interface KomandorStoreEmailSource {
  request_number?: string | null;
  request_date?: Date | string | null;
  store_code?: string | null;
  store_name?: string | null;
  store_address?: string | null;
  directors?: KomandorPerson[] | null;
  zdf?: KomandorPerson[] | null;
  channel?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  sentiment?: string | null;
  request_status?: string | null;
  description?: string | null;
  contact_info?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  customer_response?: string | null;
}

export function buildKomandorStoreEmail(r: KomandorStoreEmailSource): string {
  return [
    `Номер: ${r.request_number || '—'}`,
    `Дата: ${formatKomandorClaimDate(r.request_date)}`,
    `Статус: ${komandorStatusLabel(r.request_status)}`,
    `Магазин: ${[r.store_code, r.store_name].filter(Boolean).join(' ') || '—'}`,
    `Адрес: ${r.store_address || '—'}`,
    `Директор: ${peopleLabel(r.directors)}`,
    `ЗДФ: ${peopleLabel(r.zdf)}`,
    `Канал: ${r.channel || '—'}`,
    `Тематика: ${r.topic || '—'}`,
    `Подтема: ${r.subtopic || '—'}`,
    `Тональность: ${komandorSentimentLabel(r.sentiment)}`,
    '',
    'Описание ситуации:',
    r.description || '—',
    '',
    'Контакт клиента:',
    r.contact_info || r.client_phone || r.client_email || '—',
    '',
    'Ответ покупателю:',
    r.customer_response?.trim() || '—',
  ].join('\n');
}

export function buildKomandorClientNotice(requestNumber?: string | null, reply?: string | null): string {
  const text = (reply || '').trim();
  if (text) return text;
  return `По вашему обращению № ${requestNumber || '—'} принято в работу.`;
}
