import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, pdf,
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_FONTS } from '@/shared/lib/pdf/pdfTheme';
import type { IBillingTransaction } from '@/entities/tenant';
import type { ITenant } from '@/entities/tenant';

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONTS.regular,
    fontSize: 10,
    color: PDF_COLORS.text,
    padding: '40pt 50pt',
    backgroundColor: PDF_COLORS.bg,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.primary,
  },
  logo: {
    fontSize: 18,
    fontFamily: PDF_FONTS.bold,
    color: PDF_COLORS.primary,
  },
  logoSub: {
    fontSize: 9,
    color: PDF_COLORS.muted,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 14,
    fontFamily: PDF_FONTS.bold,
    color: PDF_COLORS.text,
  },
  docNumber: {
    fontSize: 9,
    color: PDF_COLORS.muted,
    marginTop: 3,
  },
  // Parties block
  parties: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  party: {
    flex: 1,
    backgroundColor: PDF_COLORS.bgGray,
    borderRadius: 6,
    padding: '10pt 12pt',
  },
  partyLabel: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    fontFamily: PDF_FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 10,
    fontFamily: PDF_FONTS.bold,
    marginBottom: 3,
  },
  partyDetail: {
    fontSize: 9,
    color: PDF_COLORS.muted,
    marginBottom: 2,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.primaryLight,
    padding: '6pt 8pt',
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '7pt 8pt',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: PDF_COLORS.bgGray,
  },
  col: { fontSize: 9 },
  colHeader: { fontSize: 9, fontFamily: PDF_FONTS.bold, color: PDF_COLORS.primary },
  colDate: { width: '15%' },
  colType: { width: '15%' },
  colDesc: { flex: 1 },
  colAmount: { width: '16%', textAlign: 'right' },
  colBalance: { width: '16%', textAlign: 'right' },
  // Summary
  summaryBox: {
    marginTop: 16,
    backgroundColor: PDF_COLORS.primaryLight,
    borderRadius: 8,
    padding: '12pt 16pt',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 40,
  },
  summaryItem: { alignItems: 'flex-end' },
  summaryLabel: { fontSize: 9, color: PDF_COLORS.muted, marginBottom: 3 },
  summaryValue: { fontSize: 13, fontFamily: PDF_FONTS.bold, color: PDF_COLORS.text },
  summaryValueGreen: { fontSize: 13, fontFamily: PDF_FONTS.bold, color: PDF_COLORS.success },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: PDF_COLORS.muted },
});

// ─── Type labels ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  deposit:    'Пополнение',
  charge:     'Списание',
  refund:     'Возврат',
  correction: 'Корректировка',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtMoney = (kopecks: number) =>
  (kopecks / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20BD';

// ─── Document component ───────────────────────────────────────────────────────

interface SellerBlock {
  name?: string;
  inn?: string;
  kpp?: string;
  bank?: string;
  bik?: string;
  account?: string;
  corrAccount?: string;
}

interface StatementProps {
  tenant: ITenant;
  transactions: IBillingTransaction[];
  balance: number;       // kopecks
  dateFrom?: string;
  dateTo?: string;
  docNumber?: string;
  seller?: SellerBlock;
}

const StatementDocument: React.FC<StatementProps> = ({
  tenant, transactions, balance, dateFrom, dateTo, docNumber, seller,
}) => {
  const generatedAt = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const totalDeposits = transactions
    .filter((t) => t.type === 'deposit' || t.type === 'refund')
    .reduce((s, t) => s + t.amount_kopecks, 0);
  const totalCharges = transactions
    .filter((t) => t.type === 'charge')
    .reduce((s, t) => s + t.amount_kopecks, 0);

  return (
    <Document
      title={`Выписка по счёту — ${tenant.name}`}
      author="KrAsterisk"
      creator="KrAsterisk Cloud Platform"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>KrAsterisk</Text>
            <Text style={s.logoSub}>Облачная платформа телефонии</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Выписка по лицевому счёту</Text>
            <Text style={s.docNumber}>
              № {docNumber ?? `ST-${tenant.id}-${Date.now().toString().slice(-6)}`}
            </Text>
            <Text style={s.docNumber}>Дата формирования: {generatedAt}</Text>
            {(dateFrom || dateTo) && (
              <Text style={s.docNumber}>
                Период: {dateFrom ? fmtDate(dateFrom) : '—'} — {dateTo ? fmtDate(dateTo) : '—'}
              </Text>
            )}
          </View>
        </View>

        {/* ── Parties ────────────────────────────────────────── */}
        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyLabel}>Поставщик услуг</Text>
            <Text style={s.partyName}>{seller?.name ?? 'KrAsterisk Cloud'}</Text>
            {seller?.inn && <Text style={s.partyDetail}>ИНН: {seller.inn}{seller.kpp ? ` / КПП: ${seller.kpp}` : ''}</Text>}
            {seller?.bank && <Text style={s.partyDetail}>Банк: {seller.bank}</Text>}
            {seller?.bik && <Text style={s.partyDetail}>БИК: {seller.bik}</Text>}
            {seller?.account && <Text style={s.partyDetail}>Р/с: {seller.account}</Text>}
          </View>
          <View style={s.party}>
            <Text style={s.partyLabel}>Абонент</Text>
            <Text style={s.partyName}>{tenant.name}</Text>
            {tenant.email && <Text style={s.partyDetail}>{tenant.email}</Text>}
            {tenant.phone && <Text style={s.partyDetail}>{tenant.phone}</Text>}
            {tenant.company_inn && <Text style={s.partyDetail}>ИНН: {tenant.company_inn}</Text>}
          </View>
        </View>

        {/* ── Table header ───────────────────────────────────── */}
        <View style={s.tableHeader}>
          <Text style={[s.col, s.colHeader, s.colDate]}>Дата</Text>
          <Text style={[s.col, s.colHeader, s.colType]}>Тип</Text>
          <Text style={[s.col, s.colHeader, s.colDesc]}>Описание</Text>
          <Text style={[s.col, s.colHeader, s.colAmount]}>Сумма</Text>
          <Text style={[s.col, s.colHeader, s.colBalance]}>Баланс</Text>
        </View>

        {/* ── Rows ───────────────────────────────────────────── */}
        {transactions.map((tx, i) => (
          <View
            key={tx.id}
            style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
          >
            <Text style={[s.col, s.colDate]}>{fmtDate(tx.created_at)}</Text>
            <Text style={[s.col, s.colType]}>{TYPE_LABEL[tx.type] ?? tx.type}</Text>
            <Text style={[s.col, s.colDesc]}>{tx.description ?? '—'}</Text>
            <Text style={[s.col, s.colAmount]}>
              {(tx.type === 'deposit' || tx.type === 'refund') ? '+' : '−'}
              {fmtMoney(tx.amount_kopecks)}
            </Text>
            <Text style={[s.col, s.colBalance]}>{fmtMoney(tx.balance_after)}</Text>
          </View>
        ))}

        {/* ── Summary ────────────────────────────────────────── */}
        <View style={s.summaryBox}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Итого пополнено</Text>
            <Text style={s.summaryValueGreen}>{fmtMoney(totalDeposits)}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Итого списано</Text>
            <Text style={s.summaryValue}>{fmtMoney(totalCharges)}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Текущий баланс</Text>
            <Text style={balance >= 0 ? s.summaryValueGreen : s.summaryValue}>
              {fmtMoney(balance)}
            </Text>
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>KrAsterisk Cloud Platform</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Страница ${pageNumber} из ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Генерирует и скачивает PDF выписку по лицевому счёту.
 * Вызывается прямо из компонента — никакого сервера не нужно.
 */
export async function downloadStatement(params: StatementProps): Promise<void> {
  const blob = await pdf(<StatementDocument {...params} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `statement_${params.tenant.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
