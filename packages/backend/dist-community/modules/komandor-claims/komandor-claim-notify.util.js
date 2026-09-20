"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KOMANDOR_STATUS_LABELS = exports.KOMANDOR_SENTIMENT_LABELS = void 0;
exports.komandorSentimentLabel = komandorSentimentLabel;
exports.komandorStatusLabel = komandorStatusLabel;
exports.formatKomandorClaimDate = formatKomandorClaimDate;
exports.buildKomandorStoreEmail = buildKomandorStoreEmail;
exports.buildKomandorClientNotice = buildKomandorClientNotice;
exports.KOMANDOR_SENTIMENT_LABELS = {
    negative: 'Негатив',
    neutral: 'Нейтрально',
    positive: 'Позитив',
};
exports.KOMANDOR_STATUS_LABELS = {
    new: 'Новая',
    in_progress: 'В работе',
    completed: 'Выполнено',
    postponed: 'Перенесено',
    impossible: 'Невозможно',
};
function komandorSentimentLabel(value) {
    if (!value)
        return '—';
    return exports.KOMANDOR_SENTIMENT_LABELS[value] ?? value;
}
function komandorStatusLabel(value) {
    if (!value)
        return '—';
    return exports.KOMANDOR_STATUS_LABELS[value] ?? value;
}
function formatKomandorClaimDate(value) {
    if (value == null || value === '')
        return '—';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split('-');
        return `${d}.${m}.${y}`;
    }
    const dt = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dt.getTime()))
        return String(value);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${dt.getFullYear()}`;
}
function peopleLabel(people) {
    if (!Array.isArray(people) || !people.length)
        return '—';
    return people
        .map((p) => [p.name, p.email].filter(Boolean).join(' <') + (p.email ? '>' : ''))
        .join(', ');
}
function buildKomandorStoreEmail(r) {
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
function buildKomandorClientNotice(requestNumber, reply) {
    const text = (reply || '').trim();
    if (text)
        return text;
    return `По вашему обращению № ${requestNumber || '—'} принято в работу.`;
}
//# sourceMappingURL=komandor-claim-notify.util.js.map