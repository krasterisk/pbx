'use strict';

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function blockedLiteral(dialect, blocked) {
  if (dialect === 'postgres') return blocked ? 'TRUE' : 'FALSE';
  return blocked ? '1' : '0';
}

/**
 * Sequential live charge used by disposable DB harness.
 * Mirrors BillingBalanceService.charge: find external_id, else debit + insert.
 */
async function applyLiveCharge(adapter, dialect, input) {
  const existing = await adapter.query(
    `SELECT id FROM billing_transactions WHERE external_id = ${sqlString(input.operationKey)}`,
  );
  if (existing.length) {
    const balance = await adapter.query(
      `SELECT balance_kopecks FROM billing_balances WHERE tenant_id = ${Number(input.tenantId)}`,
    );
    return { replay: true, balanceKopecks: Number(balance[0].balance_kopecks) };
  }
  const rows = await adapter.query(
    `SELECT balance_kopecks, credit_limit_kopecks FROM billing_balances WHERE tenant_id = ${Number(input.tenantId)}`,
  );
  if (!rows.length) throw new Error(`balance missing for tenant ${input.tenantId}`);
  const before = Number(rows[0].balance_kopecks);
  const after = before - Number(input.amountKopecks);
  const blocked = after < 0 && Number(rows[0].credit_limit_kopecks) === 0;
  await adapter.query(
    `UPDATE billing_balances SET balance_kopecks = ${after}, is_blocked = ${blockedLiteral(dialect, blocked)}
     WHERE tenant_id = ${Number(input.tenantId)}`,
  );
  await adapter.query(
    `INSERT INTO billing_transactions
      (tenant_id, type, amount_kopecks, balance_before, balance_after, description, performed_by, external_id, created_at)
     VALUES (${Number(input.tenantId)}, 'charge', ${Number(input.amountKopecks)}, ${before}, ${after},
      ${sqlString(input.description || 'lab charge')}, 0, ${sqlString(input.operationKey)}, CURRENT_TIMESTAMP)`,
  );
  return { replay: false, balanceKopecks: after };
}

module.exports = { applyLiveCharge, sqlString };
