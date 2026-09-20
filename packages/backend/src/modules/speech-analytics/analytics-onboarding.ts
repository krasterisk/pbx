import {
  emptySkuStores, processingAdmission, type SkuStores,
} from '../ai-usage/sku-catalog';
import { DEFAULT_CLOUD_WALLET_GATE, cloudWalletLive, type CloudWalletGate } from '../ai-usage/shadow-settlement';

export const ANALYTICS_ONBOARDING_STEPS = [
  'project', 'integration_key', 'sample_upload', 'result',
] as const;
export type AnalyticsOnboardingStep = typeof ANALYTICS_ONBOARDING_STEPS[number];

export const PBX_FIELD_NAMES = ['ami', 'ari', 'pbx', 'queue', 'queue_log', 'cdr'] as const;

export type AnalysisRecord = {
  id: string;
  tenantUid: number;
  projectId: string;
  scope: 'analytics:read' | 'analytics:transcript' | 'analytics:audio';
  status: 'queued' | 'ready' | 'deleted';
};

export type RetentionReceipt = {
  kind: 'delete' | 'export' | 'offboard';
  tenantUid: number;
  resourceId: string;
  allowed: boolean;
  reason: string | null;
  acl: readonly string[];
};

export type AnalyticsOnboardingStores = {
  sku: SkuStores;
  projects: Map<string, { tenantUid: number; name: string }>;
  keys: Map<string, { tenantUid: number; projectId: string; secretShown: boolean }>;
  uploads: Map<string, { tenantUid: number; projectId: string; complete: boolean }>;
  analyses: Map<string, AnalysisRecord>;
  receipts: RetentionReceipt[];
};

export function emptyAnalyticsOnboarding(): AnalyticsOnboardingStores {
  return {
    sku: emptySkuStores(),
    projects: new Map(),
    keys: new Map(),
    uploads: new Map(),
    analyses: new Map(),
    receipts: [],
  };
}

export function hidePbxFields<T extends Record<string, unknown>>(profile: string, row: T): T {
  if (profile !== 'analytics-api' && profile !== 'robot-api') return row;
  const next = { ...row };
  for (const key of PBX_FIELD_NAMES) delete next[key];
  return next;
}

function fail(code: string): never {
  throw Object.assign(new Error(code), { code });
}

export function analyticsOnboardingRequiresRobots(): false {
  return false;
}

export function onboardAnalytics(input: {
  stores: AnalyticsOnboardingStores;
  tenantUid: number;
  now: Date;
  step: AnalyticsOnboardingStep;
  projectId?: string;
  keyId?: string;
  uploadId?: string;
  analysisId?: string;
  name?: string;
}): { step: AnalyticsOnboardingStep; next: AnalyticsOnboardingStep | 'done'; id?: string } {
  const admission = processingAdmission(input.stores.sku, {
    tenantUid: input.tenantUid, product: 'speech_analytics', now: input.now,
  });
  if (!admission.allowed) fail(admission.reason ?? 'not_entitled');
  if (input.step === 'project') {
    const id = `proj-${input.tenantUid}`;
    input.stores.projects.set(id, { tenantUid: input.tenantUid, name: input.name ?? 'Pilot' });
    return { step: 'project', next: 'integration_key', id };
  }
  const projectId = input.projectId ?? `proj-${input.tenantUid}`;
  const project = input.stores.projects.get(projectId);
  if (!project || project.tenantUid !== input.tenantUid) fail('project_tenant_denied');
  if (input.step === 'integration_key') {
    const id = `key-${input.tenantUid}`;
    input.stores.keys.set(id, { tenantUid: input.tenantUid, projectId, secretShown: false });
    return { step: 'integration_key', next: 'sample_upload', id };
  }
  const key = input.stores.keys.get(input.keyId ?? `key-${input.tenantUid}`);
  if (!key || key.tenantUid !== input.tenantUid) fail('key_tenant_denied');
  if (input.step === 'sample_upload') {
    const id = `up-${input.tenantUid}`;
    input.stores.uploads.set(id, { tenantUid: input.tenantUid, projectId, complete: true });
    return { step: 'sample_upload', next: 'result', id };
  }
  const upload = input.stores.uploads.get(input.uploadId ?? `up-${input.tenantUid}`);
  if (!upload || upload.tenantUid !== input.tenantUid || !upload.complete) fail('upload_missing');
  const id = input.analysisId ?? `run-${input.tenantUid}`;
  input.stores.analyses.set(id, {
    id, tenantUid: input.tenantUid, projectId, scope: 'analytics:read', status: 'ready',
  });
  return { step: 'result', next: 'done', id };
}

export function rotateIntegrationKey(
  stores: AnalyticsOnboardingStores, tenantUid: number, keyId: string,
): { secretOnce: string } {
  const key = stores.keys.get(keyId);
  if (!key || key.tenantUid !== tenantUid) fail('key_tenant_denied');
  if (key.secretShown) fail('secret_already_shown');
  key.secretShown = true;
  return { secretOnce: `sa-once-${keyId}` };
}

export function exportAnalysis(
  stores: AnalyticsOnboardingStores,
  tenantUid: number,
  analysisId: string,
  requestedScope: AnalysisRecord['scope'],
): RetentionReceipt {
  const row = stores.analyses.get(analysisId);
  if (!row || row.tenantUid !== tenantUid) {
    const receipt = {
      kind: 'export' as const, tenantUid, resourceId: analysisId, allowed: false,
      reason: 'acl_denied', acl: [] as const,
    };
    stores.receipts.push(receipt);
    return receipt;
  }
  if (requestedScope !== 'analytics:read' && requestedScope !== row.scope) {
    const receipt = {
      kind: 'export' as const, tenantUid, resourceId: analysisId, allowed: false,
      reason: 'acl_not_expanded', acl: [row.scope],
    };
    stores.receipts.push(receipt);
    return receipt;
  }
  const receipt = {
    kind: 'export' as const, tenantUid, resourceId: analysisId, allowed: true,
    reason: null, acl: [row.scope],
  };
  stores.receipts.push(receipt);
  return receipt;
}

export function deleteAnalysis(
  stores: AnalyticsOnboardingStores,
  tenantUid: number,
  analysisId: string,
  now: Date,
  retentionUntil: Date,
): RetentionReceipt {
  const row = stores.analyses.get(analysisId);
  if (!row || row.tenantUid !== tenantUid) {
    const receipt = {
      kind: 'delete' as const, tenantUid, resourceId: analysisId, allowed: false,
      reason: 'acl_denied', acl: [] as const,
    };
    stores.receipts.push(receipt);
    return receipt;
  }
  if (retentionUntil > now) {
    const receipt = {
      kind: 'delete' as const, tenantUid, resourceId: analysisId, allowed: false,
      reason: 'retention_hold', acl: [row.scope],
    };
    stores.receipts.push(receipt);
    return receipt;
  }
  row.status = 'deleted';
  const receipt = {
    kind: 'delete' as const, tenantUid, resourceId: analysisId, allowed: true,
    reason: null, acl: [row.scope],
  };
  stores.receipts.push(receipt);
  return receipt;
}

export function offboardAnalytics(stores: AnalyticsOnboardingStores, tenantUid: number): RetentionReceipt {
  for (const row of stores.analyses.values()) {
    if (row.tenantUid === tenantUid) row.status = 'deleted';
  }
  const receipt = {
    kind: 'offboard' as const, tenantUid, resourceId: `tenant:${tenantUid}`, allowed: true,
    reason: null, acl: ['analytics:read'] as const,
  };
  stores.receipts.push(receipt);
  return receipt;
}

export function defaultBillableGate(): CloudWalletGate {
  return DEFAULT_CLOUD_WALLET_GATE;
}

export function analyticsCiUsesShadow(gate: CloudWalletGate = defaultBillableGate()): boolean {
  return !cloudWalletLive(gate);
}
