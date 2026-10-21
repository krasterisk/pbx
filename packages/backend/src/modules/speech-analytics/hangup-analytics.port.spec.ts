import { HangupAnalyticsPortService } from './hangup-analytics.port';
import type { HangupAnalysisJobInput } from '../routes/dialplan-webhooks.service';

describe('HangupAnalyticsPortService (G-18-01, D-03)', () => {
  const projectId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4016';
  const originKey = `8:node-1:1700000000.1:${projectId}:1`;

  function createPort(
    opts: {
      entitled?: boolean;
      pauseNew?: boolean;
      policyPause?: boolean;
      project?: Record<string, unknown> | null;
      knownRelations?: Array<{ source_id: string; recording_id: string }>;
      existingRun?: { job_id: string; id: string } | null;
      admitReplay?: boolean;
      worker?: { processJob: jest.Mock } | null;
    } = {},
  ) {
    const products = {
      decide: jest.fn().mockResolvedValue({ allowed: opts.entitled !== false }),
    };
    const moduleSettings = {
      get: jest.fn().mockReturnValue({ pauseNew: opts.pauseNew === true }),
    };
    const admission = {
      openSpeechJobIds: jest.fn().mockResolvedValue([]),
      settle: jest.fn().mockResolvedValue(undefined),
      admit: jest.fn().mockResolvedValue({
        status: 202,
        jobId: opts.admitReplay ? 'job-replay' : 'job-new',
        replay: opts.admitReplay === true,
      }),
    };
    const config = {
      get: jest.fn((key: string) =>
        ['DASHBOARD_NODE_ID', 'ASTERISK_NODE_ID'].includes(key)
          ? 'node-1'
          : undefined,
      ),
    };
    const sequelize = {
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ LOCK: { UPDATE: 'UPDATE' } }),
      ),
    };
    const projects = {
      findOne: jest.fn().mockResolvedValue(
        opts.project === null
          ? null
          : (opts.project ?? {
              id: projectId,
              tenant_uid: 8,
              status: 'active',
              active_version_id: 'ver-1',
            }),
      ),
    };
    const policies = {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.policyPause
            ? { pause_new: true, revision: 1 }
            : { pause_new: false, revision: 1 },
        ),
    };
    const recordings = {
      create: jest
        .fn()
        .mockImplementation(async (row: Record<string, unknown>) => row),
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.existingRun
            ? { id: 'rec-existing', asset_id: 'asset-existing' }
            : null,
        ),
      findAll: jest
        .fn()
        .mockResolvedValue(
          (opts.knownRelations ?? []).map((r) => ({
            id: r.recording_id,
            metadata: JSON.stringify({ originKey: r.source_id }),
          })),
        ),
    };
    const runs = {
      create: jest
        .fn()
        .mockImplementation(async (row: Record<string, unknown>) => row),
      findOne: jest.fn().mockResolvedValue(opts.existingRun ?? null),
    };
    const assets = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(async (row: Record<string, unknown>) => row),
    };
    const relations = {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.existingRun
            ? {
                recording_id: 'rec-existing',
                source_id: jobInput.uniqueid,
                node_id: 'node-1',
              }
            : null,
        ),
      findAll: jest.fn().mockResolvedValue(opts.knownRelations ?? []),
      create: jest
        .fn()
        .mockImplementation(async (row: Record<string, unknown>) => row),
    };
    const worker =
      opts.worker === undefined
        ? { processJob: jest.fn().mockResolvedValue({ state: 'queued' }) }
        : opts.worker;

    const port = new HangupAnalyticsPortService(
      products as any,
      moduleSettings as any,
      admission as any,
      config as any,
      sequelize as any,
      projects as any,
      policies as any,
      recordings as any,
      runs as any,
      assets as any,
      relations as any,
      worker as any,
    );

    return {
      port,
      products,
      moduleSettings,
      admission,
      projects,
      policies,
      recordings,
      runs,
      assets,
      relations,
      worker,
      sequelize,
      config,
    };
  }

  const jobInput: HangupAnalysisJobInput = {
    tenantUid: 8,
    routeUid: 42,
    projectId,
    uniqueid: '1700000000.1',
    recordPath: '8/calls/20260922/rec-1',
    durationSec: 45,
    policyRevision: 1,
    nodeId: 'node-1',
    originKey,
  };

  it('reuses the same physical asset across policy revisions', async () => {
    const { port, assets, admission, recordings } = createPort();
    assets.findOne.mockResolvedValue({
      id: 'shared-asset',
      tenant_uid: 8,
      source_kind: 'hangup',
      state: 'ready',
      deleted_at: null,
      retention_at: null,
      media_metadata: JSON.stringify({
        originKey,
        recordPath: jobInput.recordPath,
      }),
    } as any);
    await port.enqueueAnalysisJob({ ...jobInput, policyRevision: 2 });
    expect(assets.create).not.toHaveBeenCalled();
    expect(recordings.create).toHaveBeenCalledWith(
      expect.objectContaining({ asset_id: 'shared-asset' }),
      expect.anything(),
    );
    expect(admission.admit).toHaveBeenCalledTimes(1);
  });

  it.each(['foreign tenant', 'foreign call', 'deleted', 'expired'])(
    'rejects a conflicting stored asset: %s',
    async (kind) => {
      const { port, assets, admission } = createPort();
      const asset = {
        id: 'shared',
        tenant_uid: 8,
        source_kind: 'hangup',
        state: 'ready',
        deleted_at: null as Date | null,
        retention_at: null as Date | null,
        media_metadata: JSON.stringify({
          originKey,
          recordPath: jobInput.recordPath,
        }),
      };
      if (kind === 'foreign tenant') asset.tenant_uid = 9;
      if (kind === 'foreign call') asset.media_metadata = '{}';
      if (kind === 'deleted') asset.deleted_at = new Date();
      if (kind === 'expired') asset.retention_at = new Date(0);
      assets.findOne.mockResolvedValue(asset as any);
      await expect(port.enqueueAnalysisJob(jobInput)).rejects.toMatchObject({
        code: 'recording_asset_conflict',
      });
      expect(admission.admit).not.toHaveBeenCalled();
    },
  );

  it('resolveHangupContext loads entitlement, pauseNew, project gates, and knownOrigins', async () => {
    const { port, products } = createPort({
      knownRelations: [{ source_id: originKey, recording_id: 'rec-1' }],
    });

    const ctx = await port.resolveHangupContext({
      tenantUid: 8,
      routeUid: 42,
      routeProjectId: projectId,
    });

    expect(products.decide).toHaveBeenCalledWith(8, 'speech_analytics');
    expect(ctx.entitled).toBe(true);
    expect(ctx.pauseNew).toBe(false);
    expect(ctx.projectActive).toBe(true);
    expect(ctx.projectPublished).toBe(true);
    expect(ctx.sameTenantProject).toBe(true);
    expect(ctx.nodeId).toBe('node-1');
    expect(ctx.knownOrigins.has(originKey)).toBe(true);
  });

  it('resolveHangupContext marks foreign project as not sameTenant', async () => {
    const { port } = createPort({
      project: {
        id: projectId,
        tenant_uid: 99,
        status: 'active',
        active_version_id: 'ver-1',
      },
    });

    const ctx = await port.resolveHangupContext({
      tenantUid: 8,
      routeUid: 42,
      routeProjectId: projectId,
    });

    expect(ctx.sameTenantProject).toBe(false);
    expect(ctx.projectActive).toBe(false);
  });

  it('enqueueAnalysisJob creates recording/run + AiJobAdmission and schedules worker async', async () => {
    const { port, admission, recordings, runs, assets, relations, worker } =
      createPort();

    const result = await port.enqueueAnalysisJob(jobInput);

    expect(result.jobId).toBe('job-new');
    expect(admission.admit).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'speech_analytics',
        kind: 'analyze',
        idempotencyKey: originKey,
        entitled: true,
      }),
      expect.anything(),
    );
    expect(recordings.create).toHaveBeenCalled();
    expect(runs.create).toHaveBeenCalled();
    expect(assets.create).toHaveBeenCalled();
    expect(relations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source_kind: 'cdr',
        source_id: jobInput.uniqueid,
        node_id: 'node-1',
        linkedid: null,
      }),
      expect.anything(),
    );
    // Worker is fire-and-forget - processJob scheduled, hangup does not await STT
    expect(worker.processJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-new',
        recordPath: jobInput.recordPath,
        tenantUid: 8,
        durationSec: 45,
        audioMs: 45_000,
      }),
    );
  });

  it('duplicate origin replays without a second chargeable admit/run', async () => {
    const { port, admission, runs, worker } = createPort({
      existingRun: { job_id: 'job-existing', id: 'run-existing' },
    });

    const result = await port.enqueueAnalysisJob(jobInput);

    expect(result.jobId).toBe('job-existing');
    expect(admission.admit).not.toHaveBeenCalled();
    expect(runs.create).not.toHaveBeenCalled();
    expect(worker.processJob).not.toHaveBeenCalled();
  });

  it('does not schedule worker when Nest worker token is absent', async () => {
    const { port, admission } = createPort({ worker: null });

    const result = await port.enqueueAnalysisJob(jobInput);

    expect(result.jobId).toBe('job-new');
    expect(admission.admit).toHaveBeenCalled();
  });
  it('keeps the long admission identity out of VARCHAR64 call relations and recomputes it', async () => {
    const f = createPort();
    const uniqueid = '1234567890.' + '1'.repeat(40),
      nodeId = 'node-' + 'a'.repeat(40);
    await f.port.enqueueAnalysisJob({
      ...jobInput,
      uniqueid,
      nodeId,
      originKey: 'forged',
    });
    expect(f.relations.create.mock.calls[0][0]).toMatchObject({
      source_kind: 'cdr',
      source_id: uniqueid,
      node_id: 'node-1',
      linkedid: null,
    });
    expect(f.admission.admit.mock.calls[0][0].idempotencyKey).toBe(
      `8:${nodeId}:${uniqueid}:${projectId}:1`,
    );
    expect(
      JSON.parse(f.recordings.create.mock.calls[0][0].metadata).originKey,
    ).not.toBe('forged');
  });
  it('binds replay to tenant/project/principal/business hash and repairs only the matching call relation', async () => {
    const f = createPort({ existingRun: { id: 'r', job_id: 'j' } });
    f.relations.findOne.mockResolvedValue(null);
    await f.port.enqueueAnalysisJob(jobInput);
    expect(f.recordings.findOne.mock.calls[0][0].where).toMatchObject({
      tenant_uid: 8,
      project_id: projectId,
      integration_principal_id: 'system:hangup',
    });
    expect(
      f.recordings.findOne.mock.calls[0][0].where.business_key_hash,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(f.relations.create.mock.calls[0][0]).toMatchObject({
      source_id: jobInput.uniqueid,
      recording_id: 'rec-existing',
    });
    expect(f.assets.create).not.toHaveBeenCalled();
    expect(f.admission.admit).not.toHaveBeenCalled();
  });
  it('does not treat malformed or foreign metadata as a known origin', async () => {
    const f = createPort();
    f.recordings.findAll.mockResolvedValue([
      { metadata: 'broken' },
      { metadata: JSON.stringify({ originKey: '99:foreign' }) },
    ] as never);
    const result = await f.port.resolveHangupContext({
      tenantUid: 8,
      routeUid: 42,
      routeProjectId: projectId,
    });
    expect(result.knownOrigins.size).toBe(0);
    expect(f.recordings.findAll.mock.calls[0][0].where).toEqual({
      tenant_uid: 8,
      project_id: projectId,
      integration_principal_id: 'system:hangup',
    });
  });
  it('rejects a missing or oversized telephone identity before admission', async () => {
    const f = createPort();
    await expect(
      f.port.enqueueAnalysisJob({ ...jobInput, uniqueid: '' }),
    ).rejects.toMatchObject({ code: 'invalid_call_identity' });
    await expect(
      f.port.enqueueAnalysisJob({ ...jobInput, nodeId: 'x'.repeat(65) }),
    ).rejects.toMatchObject({ code: 'invalid_call_identity' });
    expect(f.admission.admit).not.toHaveBeenCalled();
  });
  it('preserves old admission keys while binding the CDR relation to the projection namespace', async () => {
    const f = createPort();
    f.config.get.mockImplementation((key) =>
      key === 'ASTERISK_NODE_ID'
        ? 'old-admission'
        : key === 'DASHBOARD_NODE_ID'
          ? 'cdr-node'
          : undefined,
    );
    const ctx = await f.port.resolveHangupContext({
      tenantUid: 8,
      routeUid: 42,
      routeProjectId: projectId,
    });
    expect(ctx.nodeId).toBe('old-admission');
    await f.port.enqueueAnalysisJob({ ...jobInput, nodeId: ctx.nodeId });
    expect(f.admission.admit.mock.calls[0][0].idempotencyKey).toBe(
      `8:old-admission:${jobInput.uniqueid}:${projectId}:1`,
    );
    expect(f.relations.create.mock.calls[0][0].node_id).toBe('cdr-node');
  });
});
