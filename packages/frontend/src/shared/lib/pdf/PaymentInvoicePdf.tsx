import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, pdf, Line, Svg,
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_FONTS } from '@/shared/lib/pdf/pdfTheme';
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
  // Top accent bar
  accentBar: {
    height: 4,
    backgroundColor: PDF_COLORS.primary,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  logo: {
    fontSize: 20,
    fontFamily: PDF_FONTS.bold,
    color: PDF_COLORS.primary,
  },
  logoSub: { fontSize: 8, color: PDF_COLORS.muted, marginTop: 3 },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: PDF_FONTS.bold,
    color: PDF_COLORS.text,
    marginBottom: 4,
  },
  invoiceMeta: { fontSize: 9, color: PDF_COLORS.muted, marginBottom: 2 },
  // Seller/Buyer
  partiesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  partyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 6,
    padding: '10pt 12pt',
  },
  partyTitle: {
    fontSize: 8,
    fontFamily: PDF_FONTS.bold,
    color: PDF_COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingBottom: 4,
  },
  partyName: {
    fontSize: 10,
    fontFamily: PDF_FONTS.bold,
    marginBottom: 4,
  },
  partyField: { fontSize: 9, color: PDF_COLORS.muted, marginBottom: 2 },
  // Items table
  tableWrap: { marginBottom: 16 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.primary,
    padding: '7pt 8pt',
    borderRadius: 4,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '8pt 8pt',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  tableRowAlt: { backgroundColor: PDF_COLORS.bgGray },
  thText: { fontSize: 9, fontFamily: PDF_FONTS.bold, color: '#FFFFFF' },
  tdText: { fontSize: 9, color: PDF_COLORS.text },
  colNum:   { width: '5%' },
  colName:  { flex: 1 },
  colQty:   { width: '10%', textAlign: 'center' },
  colUnit:  { width: '10%', textAlign: 'center' },
  colPrice: { width: '18%', textAlign: 'right' },
  colTotal: { width: '18%', textAlign: 'right' },
  // Total block
  totalBlock: {
    alignSelf: 'flex-end',
    width: '50%',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '6pt 12pt',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '8pt 12pt',
    backgroundColor: PDF_COLORS.primaryLight,
  },
  totalLabel: { fontSize: 9, color: PDF_COLORS.muted },
  totalValue: { fontSize: 9, fontFamily: PDF_FONTS.bold },
  totalLabelFinal: { fontSize: 11, fontFamily: PDF_FONTS.bold },
  totalValueFinal: { fontSize: 11, fontFamily: PDF_FONTS.bold, color: PDF_COLORS.primary },
  // Payment details
  paymentBox: {
    backgroundColor: PDF_COLORS.bgGray,
    borderRadius: 6,
    padding: '10pt 12pt',
    marginBottom: 20,
  },
  paymentTitle: {
    fontSize: 9,
    fontFamily: PDF_FONTS.bold,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: PDF_COLORS.muted,
  },
  paymentRow: { flexDirection: 'row', marginBottom: 4 },
  paymentKey: { width: '30%', fontSize: 9, color: PDF_COLORS.muted },
  paymentVal: { flex: 1, fontSize: 9 },
  // Note
  noteBox: {
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
    paddingLeft: 10,
    marginBottom: 20,
  },
  noteText: { fontSize: 9, color: PDF_COLORS.muted, lineHeight: 1.5 },
  // Signature
  sigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  sigBlock: { width: '40%' },
  sigTitle: { fontSize: 9, color: PDF_COLORS.muted, marginBottom: 24 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: PDF_COLORS.text, marginBottom: 4 },
  sigLabel: { fontSize: 8, color: PDF_COLORS.muted },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
  },
  footerText: { fontSize: 8, color: PDF_COLORS.muted },
});

// ─── Data types ───────────────────────────────────────────────────────────────

export interface InvoiceItem {
  name: string;
  qty: number;
  unit: string;
  price: number;   // рубли
  total: number;   // рубли
}

export interface InvoicePdfProps {
  tenant: ITenant;
  items: InvoiceItem[];
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  vatPercent?: number;    // НДС, например 20. 0 = без НДС
  note?: string;
  /** Реквизиты поставщика */
  seller?: {
    name: string;
    inn?: string;
    kpp?: string;
    bank?: string;
    bik?: string;
    account?: string;
    corrAccount?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtMoney = (rub: number) =>
  rub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Document ─────────────────────────────────────────────────────────────────

const InvoiceDocument: React.FC<InvoicePdfProps> = ({
  tenant, items, invoiceNumber, invoiceDate, dueDate, vatPercent = 0, note, seller,
}) => {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const vat = vatPercent > 0 ? subtotal * (vatPercent / 100) : 0;
  const total = subtotal + vat;

  const defaultSeller = {
    name: 'KrAsterisk Cloud',
    inn: '0000000000',
    bank: 'АО "Банк"',
    bik: '000000000',
    account: '00000000000000000000',
    corrAccount: '30101000000000000000',
    ...seller,
  };

  return (
    <Document
      title={`Счёт №${invoiceNumber} — ${tenant.name}`}
      author="KrAsterisk"
      creator="KrAsterisk Cloud Platform"
    >
      <Page size="A4" style={s.page}>
        {/* Accent top bar */}
        <View style={s.accentBar} />

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>KrAsterisk</Text>
            <Text style={s.logoSub}>Облачная платформа телефонии</Text>
          </View>
          <View>
            <Text style={s.invoiceTitle}>Счёт на оплату</Text>
            <Text style={s.invoiceMeta}>№ {invoiceNumber}</Text>
            <Text style={s.invoiceMeta}>от {fmtDate(invoiceDate)}</Text>
            {dueDate && <Text style={s.invoiceMeta}>Оплатить до: {fmtDate(dueDate)}</Text>}
          </View>
        </View>

        {/* Seller / Buyer */}
        <View style={s.partiesRow}>
          <View style={s.partyBox}>
            <Text style={s.partyTitle}>Поставщик</Text>
            <Text style={s.partyName}>{defaultSeller.name}</Text>
            {defaultSeller.inn && <Text style={s.partyField}>ИНН: {defaultSeller.inn}{defaultSeller.kpp ? ` / КПП: ${defaultSeller.kpp}` : ''}</Text>}
          </View>
          <View style={s.partyBox}>
            <Text style={s.partyTitle}>Покупатель</Text>
            <Text style={s.partyName}>{tenant.name}</Text>
            {tenant.company_inn && <Text style={s.partyField}>ИНН: {tenant.company_inn}</Text>}
            {tenant.email && <Text style={s.partyField}>{tenant.email}</Text>}
          </View>
        </View>

        {/* Payment details */}
        {(defaultSeller.bank || defaultSeller.account) && (
          <View style={s.paymentBox}>
            <Text style={s.paymentTitle}>Банковские реквизиты поставщика</Text>
            {defaultSeller.bank && (
              <View style={s.paymentRow}><Text style={s.paymentKey}>Банк:</Text><Text style={s.paymentVal}>{defaultSeller.bank}</Text></View>
            )}
            {defaultSeller.bik && (
              <View style={s.paymentRow}><Text style={s.paymentKey}>БИК:</Text><Text style={s.paymentVal}>{defaultSeller.bik}</Text></View>
            )}
            {defaultSeller.corrAccount && (
              <View style={s.paymentRow}><Text style={s.paymentKey}>Корр. счёт:</Text><Text style={s.paymentVal}>{defaultSeller.corrAccount}</Text></View>
            )}
            {defaultSeller.account && (
              <View style={s.paymentRow}><Text style={s.paymentKey}>Расч. счёт:</Text><Text style={s.paymentVal}>{defaultSeller.account}</Text></View>
            )}
          </View>
        )}

        {/* Items table */}
        <View style={s.tableWrap}>
          <View style={s.tableHead}>
            <Text style={[s.thText, s.colNum]}>№</Text>
            <Text style={[s.thText, s.colName]}>Наименование</Text>
            <Text style={[s.thText, s.colQty]}>Кол.</Text>
            <Text style={[s.thText, s.colUnit]}>Ед.</Text>
            <Text style={[s.thText, s.colPrice]}>Цена, ₽</Text>
            <Text style={[s.thText, s.colTotal]}>Сумма, ₽</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tdText, s.colNum]}>{i + 1}</Text>
              <Text style={[s.tdText, s.colName]}>{item.name}</Text>
              <Text style={[s.tdText, s.colQty]}>{item.qty}</Text>
              <Text style={[s.tdText, s.colUnit]}>{item.unit}</Text>
              <Text style={[s.tdText, s.colPrice]}>{fmtMoney(item.price)}</Text>
              <Text style={[s.tdText, s.colTotal]}>{fmtMoney(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalBlock}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Итого без НДС:</Text>
            <Text style={s.totalValue}>{fmtMoney(subtotal)} ₽</Text>
          </View>
          {vatPercent > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>НДС {vatPercent}%:</Text>
              <Text style={s.totalValue}>{fmtMoney(vat)} ₽</Text>
            </View>
          )}
          {vatPercent === 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>НДС:</Text>
              <Text style={s.totalValue}>Без НДС</Text>
            </View>
          )}
          <View style={s.totalRowFinal}>
            <Text style={s.totalLabelFinal}>ИТОГО к оплате:</Text>
            <Text style={s.totalValueFinal}>{fmtMoney(total)} ₽</Text>
          </View>
        </View>

        {/* Note */}
        {note && (
          <View style={s.noteBox}>
            <Text style={s.noteText}>{note}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={s.sigRow}>
          <View style={s.sigBlock}>
            <Text style={s.sigTitle}>Руководитель</Text>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>подпись / расшифровка</Text>
          </View>
          <View style={s.sigBlock}>
            <Text style={s.sigTitle}>Главный бухгалтер</Text>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>подпись / расшифровка</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>KrAsterisk Cloud Platform</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Стр. ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

// ─── Public API ───────────────────────────────────────────────────────────────

export async function downloadInvoice(props: InvoicePdfProps): Promise<void> {
  const blob = await pdf(<InvoiceDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice_${props.invoiceNumber}_${props.tenant.name.replace(/\s+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Генерирует счёт на основе активных модулей тенанта.
 */
export function buildModulesInvoice(
  modules: Array<{ name: string; price_monthly: number }>,
  months = 1,
): InvoiceItem[] {
  return modules
    .filter((m) => m.price_monthly > 0)
    .map((m) => ({
      name:  `${m.name} (${months} мес.)`,
      qty:   months,
      unit:  'мес.',
      price: m.price_monthly,
      total: m.price_monthly * months,
    }));
}
