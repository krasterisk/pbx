import {
  buildKomandorClientNotice,
  buildKomandorStoreEmail,
  formatKomandorClaimDate,
  komandorSentimentLabel,
  komandorStatusLabel,
} from './komandor-claim-notify.util';

describe('komandor-claim-notify.util', () => {
  it('maps sentiment and status codes to Russian labels', () => {
    expect(komandorSentimentLabel('negative')).toBe('Негатив');
    expect(komandorSentimentLabel('neutral')).toBe('Нейтрально');
    expect(komandorSentimentLabel('positive')).toBe('Позитив');
    expect(komandorStatusLabel('in_progress')).toBe('В работе');
    expect(komandorStatusLabel('new')).toBe('Новая');
  });

  it('formats YYYY-MM-DD without timezone shift', () => {
    expect(formatKomandorClaimDate('2026-08-26')).toBe('26.08.2026');
    expect(formatKomandorClaimDate('2026-08-26T00:00:00.000Z')).toBe('26.08.2026');
  });

  it('uses Russian labels in store email instead of raw codes', () => {
    const text = buildKomandorStoreEmail({
      request_number: 'КМ-260826-0001',
      request_date: '2026-08-26',
      request_status: 'in_progress',
      store_code: '101',
      store_name: 'Центр',
      sentiment: 'negative',
      description: 'Истёк срок годности',
    });

    expect(text).toContain('Тональность: Негатив');
    expect(text).toContain('Статус: В работе');
    expect(text).toContain('Дата: 26.08.2026');
    expect(text).not.toContain('Тональность: negative');
    expect(text).not.toContain('Статус: in_progress');
  });

  it('uses operator reply for client SMS/email when present', () => {
    expect(buildKomandorClientNotice('КМ-1', '  Спасибо, товар заменён  ')).toBe('Спасибо, товар заменён');
    expect(buildKomandorClientNotice('КМ-1', '')).toBe('По вашему обращению № КМ-1 принято в работу.');
  });
});
