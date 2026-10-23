import ExcelJS from 'exceljs';
import type { CallsAttention } from '@krasterisk/shared';

export function callExportTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).format(new Date(value));
}
export function safeExportCell(value: unknown): string {
  const text = String(value ?? '');
  const first = [...text].find(character => character.trim() !== '' && character.charCodeAt(0) > 31);
  return first && '=+-@'.includes(first) ? `'${text}` : text;
}
export async function exportCallAttention(data: CallsAttention, format: 'csv' | 'xlsx'): Promise<Buffer> {
  const states = {waiting:'Ожидает перезвона', overdue:'Просрочен', outboundConnected:'Перезвонили', customerReturned:'Клиент перезвонил', unknown:'Недостаточно данных'};
  const header = ['Номер клиента', 'Номер компании', 'Статус', 'Первое обращение', 'Срок перезвона', 'Обращений', 'Охват', 'Обновлено', 'Ограничен правами'];
  const rows = data.rows.map(row => [row.number, row.companyNumber, states[row.state], callExportTime(row.firstAt, data.timezone), callExportTime(row.deadline, data.timezone), row.sourceCalls, data.coverage, callExportTime(data.snapshotAt, data.timezone), data.scopeLimited ? 'Да' : 'Нет']);
  if (format === 'csv') {
    const cell = (value: unknown) => `"${safeExportCell(value).replace(/"/g,'""')}"`;
    return Buffer.from('\uFEFF'+[header, ...rows].map(row => row.map(cell).join(';')).join('\r\n'), 'utf8');
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Пропущенные и перезвоны');
  sheet.addRow(header);
  for (const row of rows) sheet.addRow(row.map(value => typeof value === 'number' ? value : safeExportCell(value)));
  sheet.getRow(1).font = {bold:true};
  sheet.views = [{state:'frozen',ySplit:1}];
  sheet.columns.forEach(column => { column.width = 24; });
  sheet.autoFilter = {from:{row:1,column:1},to:{row:rows.length+1,column:header.length}};
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
