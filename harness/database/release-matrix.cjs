'use strict';
// AI-11 11M release matrix helpers. Aggregate evidence; name pending gates. Not SLA.
const fs = require('node:fs');
const path = require('node:path');

const ENGINES = Object.freeze(['mysql', 'postgres']);
const PROFILES = Object.freeze([
  { id: 'DEP-01', name: 'community-core', evidence: null, note: 'community composition gate (source boundary)' },
  { id: 'DEP-02', name: 'saas-two-tenant', evidence: '11a', note: 'pilot A/B isolation LIVE-UAT' },
  { id: 'DEP-03', name: 'analytics-only', evidence: '11a', note: 'analytics-api LIVE-UAT' },
  { id: 'DEP-04', name: 'robots-only', evidence: '11r', note: 'robot-api LIVE-UAT' },
  { id: 'DEP-05', name: 'offline-license', evidence: '11o', note: 'key sidecar / missing-key fail-closed' },
  { id: 'DEP-06', name: 'no-undeclared-egress', evidence: null, note: 'policy: CI shadow; no live providers in matrix' },
  { id: 'DEP-07', name: 'ops-drills', evidence: '11o', note: 'backup→restore→upgrade→drain→admit' },
  { id: 'DEP-08', name: 'version-skew-policy', evidence: null, note: 'documented: N-1→current only; no cross-engine' },
  { id: 'DBR-06', name: 'ledger-concurrency', evidence: '11f', note: 'idempotent replay zero second debit (shadow)' },
  { id: 'DBR-07', name: 'cross-engine-refuse', evidence: '11o', note: 'dialect switch refused' },
  { id: 'DBR-08', name: 'outbox-concurrency', evidence: '11f', note: 'duplicate delivery CAS / redis rehydrate' },
]);

const PENDING_GATES = Object.freeze([
  'met5_30_call_holdout_not_claimed',
  'local_ai_stt_hardware_not_claimed',
  'host_unixodbc_asterisk_module_load_not_claimed',
  'tls_srtp_nat_not_closed',
  'live_mcp_true_not_closed',
  'product_runtime_still_not_installed',
  'commercial_readiness_not_declared',
]);

const EVIDENCE_ROOT = path.join(__dirname, '../../.planning/initiatives/ai-products/evidence');

function evidenceExists(slice) {
  if (!slice) return { present: false, path: null };
  const remote = path.join(EVIDENCE_ROOT, slice, 'REMOTE-MATRIX.md');
  return { present: fs.existsSync(remote), path: remote.replaceAll('\\', '/') };
}

function aggregateMatrix(installRows = []) {
  const rows = PROFILES.map((profile) => {
    const ev = evidenceExists(profile.evidence);
    return {
      ...profile,
      evidencePresent: profile.evidence ? ev.present : null,
      evidencePath: ev.path,
      engines: ENGINES.slice(),
    };
  });
  return {
    revision: '2026-09-20-r1',
    phase: 'AI-11',
    task: '11M',
    kind: 'RELEASE-matrix',
    productSlaClaimed: false,
    commercialReadinessDeclared: false,
    engines: ENGINES.slice(),
    profiles: rows,
    installs: installRows,
    pendingGates: PENDING_GATES.slice(),
    versionSkewPolicy: {
      supported: 'N-1 → current via I3/11O; empty→current via I1',
      refused: 'automatic --rollback; cross-engine restore (DBR-07)',
      engines: 'MySQL 8.4.11 and PostgreSQL 17.11 only for this matrix',
    },
    constraints: {
      noLiveTenantDebit: true,
      noAutodial: true,
      noXrayUi: true,
      productRuntime: 'not-installed',
      noSilentMockPass: true,
    },
  };
}

function assertNoSilentMock(matrix) {
  for (const gate of matrix.pendingGates) {
    if (!gate.includes('not_') && !gate.includes('still_') && !gate.includes('not_declared')) {
      throw new Error(`pending gate must be explicitly open-named: ${gate}`);
    }
  }
  if (matrix.productSlaClaimed || matrix.commercialReadinessDeclared) {
    throw new Error('11M must not claim SLA or commercial readiness');
  }
  return true;
}

module.exports = {
  ENGINES, PROFILES, PENDING_GATES, EVIDENCE_ROOT,
  evidenceExists, aggregateMatrix, assertNoSilentMock,
};
