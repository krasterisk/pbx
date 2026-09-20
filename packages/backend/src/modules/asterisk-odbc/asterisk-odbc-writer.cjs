'use strict';
const crypto = require('crypto');

const CDR_COLUMNS = [
  'calldate', 'clid', 'src', 'usrc', 'dst', 'dcontext', 'channel', 'dstchannel',
  'lastapp', 'lastdata', 'duration', 'billsec', 'disposition', 'uniqueid', 'linkedid',
  'userfield', 'dialednum', 'transid', 'record', 'vpbx_user_uid', 'useruid', 'dstuseruid',
];

const QUEUE_LOG_COLUMNS = [
  'time', 'callid', 'queuename', 'agent', 'event', 'data',
  'data1', 'data2', 'data3', 'data4', 'data5', 'userfield', 'event_id',
];

const CEL_COLUMNS = [
  'eventtype', 'eventtime', 'userdeftype', 'cid_name', 'cid_num', 'cid_ani', 'cid_rdnis',
  'cid_dnid', 'exten', 'context', 'channame', 'appname', 'appdata', 'amaflags',
  'accountcode', 'uniqueid', 'linkedid', 'peer', 'userfield', 'extra', 'event_id',
];

function placeholders(count, dialect) {
  if (dialect === 'postgres') {
    return Array.from({ length: count }, (_, index) => `$${index + 1}`).join(', ');
  }
  return Array.from({ length: count }, () => '?').join(', ');
}

function insertSql(table, columns, dialect) {
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders(columns.length, dialect)})`;
}

function eventId(parts) {
  return crypto.createHash('sha256').update(parts.map(part => String(part ?? '')).join('\0')).digest('hex');
}

function isUniqueViolation(error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'ER_DUP_ENTRY' || code === '23505' || /duplicate|unique constraint/i.test(message);
}

function cdrValues(row) {
  return CDR_COLUMNS.map((column) => {
    if (row[column] != null && row[column] !== '') return row[column];
    if (column === 'duration' || column === 'billsec' || column === 'vpbx_user_uid') return 0;
    if (column === 'useruid' || column === 'dstuseruid') return null;
    return '';
  });
}

function queueLogValues(row) {
  const event_id = row.event_id || eventId([
    row.time, row.callid, row.queuename, row.agent, row.event,
    row.data, row.data1, row.data2, row.data3, row.data4, row.data5,
  ]);
  return QUEUE_LOG_COLUMNS.map(column => (column === 'event_id' ? event_id : (row[column] ?? null)));
}

function celValues(row) {
  const event_id = row.event_id || eventId([
    row.eventtype, row.eventtime, row.uniqueid, row.linkedid, row.channame, row.eventtype, row.extra,
  ]);
  return CEL_COLUMNS.map(column => (column === 'event_id' ? event_id : (row[column] ?? (column === 'amaflags' ? 0 : ''))));
}

async function writeOnce(exec, sql, params) {
  try {
    await exec(sql, params);
    return 'inserted';
  } catch (error) {
    if (isUniqueViolation(error)) return 'replayed';
    throw error;
  }
}

async function writeCdr(exec, dialect, row) {
  return writeOnce(exec, insertSql('cdr', CDR_COLUMNS, dialect), cdrValues(row));
}

async function writeQueueLog(exec, dialect, row) {
  return writeOnce(exec, insertSql('queue_log', QUEUE_LOG_COLUMNS, dialect), queueLogValues(row));
}

async function writeCel(exec, dialect, row) {
  return writeOnce(exec, insertSql('cel', CEL_COLUMNS, dialect), celValues(row));
}

module.exports = {
  CDR_COLUMNS,
  QUEUE_LOG_COLUMNS,
  CEL_COLUMNS,
  insertSql,
  eventId,
  isUniqueViolation,
  writeCdr,
  writeQueueLog,
  writeCel,
  cdrValues,
  queueLogValues,
  celValues,
};
