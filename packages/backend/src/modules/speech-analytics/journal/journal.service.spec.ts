import { ForbiddenException } from '@nestjs/common';
import { UserLevel } from '../../users/user.model';
import {
  SaJournalService,
  canEditConversationScores,
  canMutateConversation,
  isJournalRowVisible,
  type JournalRowAccessFields,
} from './journal.service';
import type { CdrAccessScope } from '../../reports/cdr/cdr-access-scope';
import type { TenantContext } from '../../integration-credentials/tenant-context';

const tenant: TenantContext = Object.freeze({
  tenantUid: 42,
  principalId: 'user:7',
  principalKind: 'user' as const,
  permissionRevision: '1:1:0:active',
  requestId: 'req-1',
});

describe('journal RBAC helpers (D-09, D-10)', () => {
  it('allows regenerate/delete only for ADMIN and SUPERADMIN', () => {
    expect(canMutateConversation(UserLevel.ADMIN)).toBe(true);
    expect(canMutateConversation(UserLevel.SUPERADMIN)).toBe(true);
    expect(canMutateConversation(UserLevel.SUPERVISOR)).toBe(false);
    expect(canMutateConversation(UserLevel.OPERATOR)).toBe(false);
    expect(canMutateConversation(UserLevel.READONLY)).toBe(false);
  });

  it('allows score/tag edits for SUPERVISOR plus admin roles, never an analyst role', () => {
    expect(canEditConversationScores(UserLevel.SUPERVISOR)).toBe(true);
    expect(canEditConversationScores(UserLevel.ADMIN)).toBe(true);
    expect(canEditConversationScores(UserLevel.SUPERADMIN)).toBe(true);
    expect(canEditConversationScores(UserLevel.OPERATOR)).toBe(false);
    expect(canEditConversationScores(UserLevel.READONLY)).toBe(false);
    expect(canEditConversationScores(99 as UserLevel)).toBe(false);
  });
});

describe('journal visibility via CDR access scope (D-11)', () => {
  const unrestricted: CdrAccessScope = { operators: [], queues: [], ownExten: null };
  const scoped: CdrAccessScope = { operators: ['101'], queues: [], ownExten: '200' };

  it('lets admin-level unrestricted viewers see every tenant row', () => {
    const row: JournalRowAccessFields = {
      id: 'r1',
      operatorExten: '999',
      operatorName: null,
      uploadedByUserId: 99,
      sourceKind: 'upload',
    };
    expect(isJournalRowVisible(row, null, { userId: 1, level: UserLevel.ADMIN })).toBe(true);
    expect(isJournalRowVisible(row, unrestricted, { userId: 1, level: UserLevel.SUPERVISOR })).toBe(true);
  });

  it('filters restricted supervisors to matching extensions and own exten', () => {
    const match: JournalRowAccessFields = {
      id: 'r2', operatorExten: '101', operatorName: null, uploadedByUserId: 5, sourceKind: 'pbx',
    };
    const own: JournalRowAccessFields = {
      id: 'r3', operatorExten: '200', operatorName: null, uploadedByUserId: 5, sourceKind: 'pbx',
    };
    const other: JournalRowAccessFields = {
      id: 'r4', operatorExten: '300', operatorName: null, uploadedByUserId: 5, sourceKind: 'pbx',
    };
    const viewer = { userId: 9, level: UserLevel.SUPERVISOR };
    expect(isJournalRowVisible(match, scoped, viewer)).toBe(true);
    expect(isJournalRowVisible(own, scoped, viewer)).toBe(true);
    expect(isJournalRowVisible(other, scoped, viewer)).toBe(false);
  });

  it('shows text-only upload rows to the uploader and unrestricted viewers', () => {
    const row: JournalRowAccessFields = {
      id: 'r5',
      operatorExten: null,
      operatorName: 'Иван',
      uploadedByUserId: 7,
      sourceKind: 'upload',
    };
    expect(isJournalRowVisible(row, scoped, { userId: 7, level: UserLevel.OPERATOR })).toBe(true);
    expect(isJournalRowVisible(row, scoped, { userId: 8, level: UserLevel.OPERATOR })).toBe(false);
    expect(isJournalRowVisible(row, unrestricted, { userId: 8, level: UserLevel.SUPERVISOR })).toBe(true);
  });
});

describe('SaJournalService list/detail/regenerate/delete (D-05, D-12, D-13)', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const recordings = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      destroy: jest.fn().mockResolvedValue(1),
      ...(overrides.recordings as object),
    };
    const runs = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'run-new' }),
      destroy: jest.fn().mockResolvedValue(1),
      ...(overrides.runs as object),
    };
    const results = { destroy: jest.fn().mockResolvedValue(1), findAll: jest.fn().mockResolvedValue([]) };
    const transcripts = { destroy: jest.fn().mockResolvedValue(1) };
    const segments = { destroy: jest.fn().mockResolvedValue(1) };
    const relations = {
      findAll: jest.fn().mockResolvedValue([]),
      destroy: jest.fn().mockResolvedValue(1),
      ...(overrides.relations as object),
    };
    const reviews = { destroy: jest.fn().mockResolvedValue(1), findAll: jest.fn().mockResolvedValue([]) };
    const users = {
      findOne: jest.fn().mockResolvedValue({
        getDataValue: (k: string) => ({ uniqueid: 7, level: UserLevel.ADMIN, numbers_id: null, exten: '100', login: 'admin' }[k]),
      }),
      ...(overrides.users as object),
    };
    const numberLists = { findOne: jest.fn().mockResolvedValue(null) };
    const wallet = { refund: jest.fn(), settleShadow: jest.fn() };

    const service = new SaJournalService(
      recordings as any,
      runs as any,
      results as any,
      transcripts as any,
      segments as any,
      relations as any,
      reviews as any,
      users as any,
      numberLists as any,
      wallet as any,
    );
    return { service, recordings, runs, results, reviews, wallet, users };
  }

  it('lists latest-run cost per conversation and keeps earlier runs on detail', async () => {
    const recording = {
      id: 'rec-1',
      tenant_uid: 42,
      project_id: 'p1',
      occurred_at: new Date('2026-09-21T10:00:00Z'),
      metadata: JSON.stringify({ operatorExten: '101', uploadedByUserId: 7 }),
      get: (k: string) => (recording as any)[k],
    };
    const { service, recordings, runs, results, relations } = buildService({
      recordings: { findAll: jest.fn().mockResolvedValue([recording]), findOne: jest.fn().mockResolvedValue(recording) },
      relations: {
        findAll: jest.fn().mockResolvedValue([{ recording_id: 'rec-1', source_kind: 'upload' }]),
      },
      runs: {
        findAll: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where?.recording_id === 'rec-1' || where?.recording_id?.['$in']) {
            return [
              { id: 'run-old', recording_id: 'rec-1', amount: '5.00', currency: 'RUB', state: 'succeeded', created_at: new Date('2026-09-20'), result_id: 'res-old' },
              { id: 'run-new', recording_id: 'rec-1', amount: '12.50', currency: 'RUB', state: 'succeeded', created_at: new Date('2026-09-21'), result_id: 'res-new' },
            ];
          }
          return [];
        }),
      },
    });
    void recordings;
    void runs;
    void results;
    void relations;

    const list = await service.list(tenant);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].latestAmount).toBe('12.50');

    const detail = await service.get(tenant, 'rec-1');
    expect(detail.runs.map((r) => r.id)).toEqual(['run-new', 'run-old']);
    expect(detail.runs).toHaveLength(2);
  });

  it('rejects regenerate/delete for supervisor and never calls wallet on delete', async () => {
    const { service, users, wallet, recordings, runs } = buildService({
      users: {
        findOne: jest.fn().mockResolvedValue({
          getDataValue: (k: string) => ({ uniqueid: 7, level: UserLevel.SUPERVISOR, numbers_id: null, exten: '100', login: 'sv' }[k]),
        }),
      },
      recordings: {
        findOne: jest.fn().mockResolvedValue({
          id: 'rec-1', tenant_uid: 42, project_id: 'p1',
          metadata: '{}',
          destroy: jest.fn(),
        }),
      },
    });

    await expect(service.regenerate(tenant, 'rec-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete(tenant, 'rec-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(wallet.refund).not.toHaveBeenCalled();
    expect(wallet.settleShadow).not.toHaveBeenCalled();
    void runs;
    void recordings;
  });

  it('admin regenerate creates a new run without dropping prior runs or reviews', async () => {
    const recording = {
      id: 'rec-1', tenant_uid: 42, project_id: 'p1',
      metadata: JSON.stringify({ operatorExten: '101' }),
      asset_id: 'asset-1',
    };
    const create = jest.fn().mockResolvedValue({ id: 'run-regen' });
    const { service, runs, reviews, wallet } = buildService({
      recordings: { findOne: jest.fn().mockResolvedValue(recording) },
      runs: {
        findOne: jest.fn().mockResolvedValue({
          id: 'run-old', recording_id: 'rec-1', project_version_id: 'ver-1', state: 'succeeded',
        }),
        create,
        findAll: jest.fn().mockResolvedValue([
          { id: 'run-old', recording_id: 'rec-1' },
          { id: 'run-regen', recording_id: 'rec-1' },
        ]),
      },
    });

    const out = await service.regenerate(tenant, 'rec-1');
    expect(out.runId).toBe('run-regen');
    expect(create).toHaveBeenCalled();
    expect(reviews.destroy).not.toHaveBeenCalled();
    expect(wallet.refund).not.toHaveBeenCalled();
  });

  it('admin delete removes conversation history and amounts without refund', async () => {
    const destroyRec = jest.fn().mockResolvedValue(undefined);
    const { service, runs, results, reviews, wallet, recordings } = buildService({
      recordings: {
        findOne: jest.fn().mockResolvedValue({
          id: 'rec-1', tenant_uid: 42, project_id: 'p1', metadata: '{}',
          destroy: destroyRec,
        }),
      },
      runs: {
        findAll: jest.fn().mockResolvedValue([{ id: 'run-1', amount: '9.00' }]),
        destroy: jest.fn().mockResolvedValue(1),
      },
    });

    const out = await service.delete(tenant, 'rec-1');
    expect(out).toEqual({ deleted: true, refunded: false });
    expect(runs.destroy).toHaveBeenCalled();
    expect(results.destroy).toHaveBeenCalled();
    expect(destroyRec).toHaveBeenCalled();
    expect(wallet.refund).not.toHaveBeenCalled();
    expect(wallet.settleShadow).not.toHaveBeenCalled();
    void reviews;
    void recordings;
  });
});
