import { digestDocument, renderNoticeHtml, renderNoticeText, type NoticeFacts } from './notice-document';
import type { SaNotice } from '@krasterisk/shared';

const facts: NoticeFacts = {
  projectName: 'Медцентр',
  periodLabel: '7 дней',
  conversationCount: 4,
  averageScore: 80,
  csat: 4.5,
  sentiment: { positive: 3, neutral: 1, negative: 0 },
  successRate: 0.75,
  costTotal: '12.00',
  currency: 'RUB',
  metrics: [{ label: 'Приветствие', avg: 75 }],
  topics: [{ label: 'Запись', count: 2 }],
  lowSttCount: 0,
  lowSttPct: 0,
};

const digest: SaNotice = {
  id: 'n1',
  kind: 'digest',
  title: 'Сводка',
  enabled: true,
  blocks: {
    calls: true,
    averageScore: true,
    csat: false,
    sentiment: true,
    success: true,
    cost: true,
    metrics: true,
    topics: true,
  },
};

describe('notice document', () => {
  it('keeps only the blocks the notice asked for and renders the same facts as text and html', () => {
    const doc = digestDocument(digest, facts);
    expect(doc.cards.map((card) => card.label)).toEqual(['Звонки', 'Средняя оценка', 'Успех', 'Стоимость', 'Тональность']);
    const text = renderNoticeText(doc);
    const html = renderNoticeHtml(doc);
    expect(text).toContain('Звонки: 4');
    expect(text).not.toContain('CSAT');
    expect(html).toContain('Медцентр');
    expect(html).toContain('Приветствие');
    expect(html).toContain('<!DOCTYPE html>');
  });
});
