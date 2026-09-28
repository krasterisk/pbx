import type { SaDigestBlocks, SaNotice } from '@krasterisk/shared';
import { defaultDigestBlocks } from '@krasterisk/shared';

export type NoticeFacts = {
  projectName: string;
  periodLabel: string;
  conversationCount: number;
  averageScore: number | null;
  csat: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  successRate: number | null;
  costTotal: string;
  currency: string | null;
  metrics: Array<{ label: string; avg: number }>;
  topics: Array<{ label: string; count: number }>;
  lowSttCount: number;
  lowSttPct: number | null;
};

export type NoticeDocument = {
  title: string;
  periodLabel: string;
  cards: Array<{ label: string; value: string }>;
  rows: Array<{ label: string; value: string }>;
  note?: string;
};

function blocksOf(notice: SaNotice): SaDigestBlocks {
  return { ...defaultDigestBlocks(), ...(notice.blocks ?? {}) };
}

function money(amount: string, currency: string | null): string {
  return `${amount}${currency ? ` ${currency}` : ''}`;
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function num(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

export function digestDocument(notice: SaNotice, facts: NoticeFacts): NoticeDocument {
  const blocks = blocksOf(notice);
  const cards: NoticeDocument['cards'] = [];
  if (blocks.calls) cards.push({ label: 'Звонки', value: String(facts.conversationCount) });
  if (blocks.averageScore) cards.push({ label: 'Средняя оценка', value: num(facts.averageScore) });
  if (blocks.csat) cards.push({ label: 'CSAT', value: num(facts.csat) });
  if (blocks.success) cards.push({ label: 'Успех', value: pct(facts.successRate) });
  if (blocks.cost) cards.push({ label: 'Стоимость', value: money(facts.costTotal, facts.currency) });
  if (blocks.sentiment) {
    cards.push({
      label: 'Тональность',
      value: `+${facts.sentiment.positive} / ${facts.sentiment.neutral} / -${facts.sentiment.negative}`,
    });
  }
  const rows: NoticeDocument['rows'] = [];
  if (blocks.metrics) {
    for (const metric of facts.metrics) rows.push({ label: metric.label, value: num(metric.avg) });
  }
  if (blocks.topics) {
    for (const topic of facts.topics) rows.push({ label: topic.label, value: String(topic.count) });
  }
  return {
    title: notice.title || 'Сводка',
    periodLabel: `${facts.projectName}. ${facts.periodLabel}`,
    cards,
    rows,
  };
}

export function alertDocument(notice: SaNotice, facts: NoticeFacts, detail: string): NoticeDocument {
  return {
    title: notice.title || 'Уведомление',
    periodLabel: facts.periodLabel,
    cards: [
      { label: 'Звонки', value: String(facts.conversationCount) },
      { label: 'Проект', value: facts.projectName },
    ],
    rows: [],
    note: detail,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderNoticeText(doc: NoticeDocument): string {
  const lines = [`${doc.title}`, doc.periodLabel, ''];
  for (const card of doc.cards) lines.push(`${card.label}: ${card.value}`);
  if (doc.rows.length) {
    lines.push('');
    for (const row of doc.rows) lines.push(`${row.label}: ${row.value}`);
  }
  if (doc.note) {
    lines.push('');
    lines.push(doc.note);
  }
  return lines.join('\n').trim();
}

export function renderNoticeHtml(doc: NoticeDocument): string {
  const cards = doc.cards.map((card) => (
    `<section class="card"><p class="label">${escapeHtml(card.label)}</p><p class="value">${escapeHtml(card.value)}</p></section>`
  )).join('');
  const rows = doc.rows.map((row) => (
    `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`
  )).join('');
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(doc.title)}</title>
<style>
  body { margin: 0; font-family: sans-serif; background: #0c1214; color: #fafafa; }
  main { max-width: 720px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .period { color: #a1a1aa; margin: 0 0 20px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; }
  .card { flex: 1 1 140px; border: 1px solid #27272a; border-radius: 12px; padding: 12px 14px; background: #111114; }
  .label { margin: 0; color: #a1a1aa; font-size: 12px; }
  .value { margin: 6px 0 0; font-size: 20px; font-weight: 650; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  td { padding: 8px 0; border-bottom: 1px solid #27272a; }
  td:last-child { text-align: right; }
  .note { margin-top: 16px; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(doc.title)}</h1>
  <p class="period">${escapeHtml(doc.periodLabel)}</p>
  <div class="cards">${cards}</div>
  ${rows ? `<table>${rows}</table>` : ''}
  ${doc.note ? `<p class="note">${escapeHtml(doc.note)}</p>` : ''}
</main>
</body>
</html>`;
}
