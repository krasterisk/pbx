'use strict';
// Local artifacts use ARTIFACTS_ROOT; standalone remote lab copies retain their remote paths.
const _artifactModule = "./../../tools/artifacts/paths.cjs";
const _artifactPath = require('node:fs').existsSync(require('node:path').resolve(__dirname, _artifactModule)) ? require(_artifactModule).artifactPath : (value) => value;

const iconv = require('iconv-lite');
const { outputPath } = require('../artifacts/paths.cjs');
const fs = require('node:fs');
const path = require('node:path');

const rows = [
  ['ФИО', 'Телефон', 'Сумма долга', 'Дата платежа', 'Договор', 'Сегмент', 'Регион'],
  ['Иванов Иван Иванович', '000501', '15 240,50', '25.10.2026', 'Д-1001', 'просрочка 30', 'Москва'],
  ['Петрова Анна', '000502', '8300', '2026-10-30', 'Д-1002', 'новый', 'Казань'],
  ['Сидоров Пётр', '000601', '1200', '01.11.2026', 'Д-1003', 'просрочка 90', 'Самара'],
  ['Кузнецова Ольга', '000701', '56000', '05.11.2026', 'Д-1004', 'новый', 'Омск'],
  ['Смирнов Олег', '000801', '990', '', 'Д-1005', 'новый', 'Тула'],
  ['Попова Елена', '000901', '3000', '10.11.2026', 'Д-1006', 'просрочка 30', 'Уфа'],
  ['Автоответчик Тест', '001001', '7000', '12.11.2026', 'Д-1007', 'новый', 'Пермь'],
  ['Васильев Денис', '001101', '12500', '15.11.2026', 'Д-1008', 'просрочка 90', 'Сочи'],
  ['Дубль Иванов', '000501', '1', '', 'Д-1009', 'новый', 'Москва'],
  ['', '000503', '100', '', 'Д-1010', 'новый', ''],
  ['Кривой Номер', 'abc-def', '100', '', 'Д-1011', 'новый', ''],
  ['Неизвестный сегмент', '000504', '500', '', 'Д-1012', 'VIP', ''],
  ['Два номера', '000505, 000602', '2500', '', 'Д-1013', 'новый', ''],
];
const outputDirectory = outputPath('runs', 'autodial', 'csv-' + Date.now());
fs.mkdirSync(outputDirectory, { recursive: true });
const csv = rows.map((r) => r.join(';')).join('\r\n') + '\r\n';
fs.writeFileSync(_artifactPath(path.join(outputDirectory, 'debtors-cp1251.csv'), { write: true }), iconv.encode(csv, 'win1251'));
fs.writeFileSync(_artifactPath(path.join(outputDirectory, 'debtors-utf8.csv'), { write: true }), '\uFEFF' + csv, 'utf8');
console.log('ok', rows.length - 1, 'rows', outputDirectory);
