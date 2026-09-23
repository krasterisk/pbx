import { HangupAnalyticsPortService } from './hangup-analytics.port';
import type { HangupAnalysisJobInput } from '../routes/dialplan-webhooks.service';

describe('HangupAnalyticsPortService (G-18-01, D-03)', () => {
  const projectId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4016';
  const originKey = `8:node-1:1700000000.1:${projectId}:1`;

  function createPort(opts: {
    entitled?: boolean;
    pauseNew?: boolean;
    policyPause?: boolean;
    project?: Record<string, unknown> | null;
    knownRelations?: Array<{ source_id: string; recording_id: string }>;
    existingRun?: { job_id: string; id: string } | null;
    admitReplay?: boolean;
    worker?: { processJob: jest.Mock } | null;
  } = {}) {
    const products = {
      decide: jest.fn().mockResolvedValue({ allowed: opts.entitled !== false }),
    };
    const moduleSettings = {
      get: jest.fn().mockReturnValue({ pauseNew: opts.pauseNew === true }),
    };
    const admission = {
      admit: jest.fn().mockResolvedValue({
        status: 202,
        jobId: opts.admitReplay ? 'job-replay' : 'job-new',
        replay: opts.admitReplay === true,
      }),
    };
    const config = {
      get: jest.fn((key: string) => (key === 'ASTERISK_NODE_ID' ? 'node-1' : undefined)),
    };
    const sequelize = {
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
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
      findOne: jest.fn().mockResolvedValue(
        opts.policyPause
          ? { pause_new: true, revision: 1 }
          : { pause_new: false, revision: 1 },
      ),
    };
    const recordings = {
      create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => row),
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue(
        (opts.knownRelations ?? []).map((r) => ({ id: r.recording_id })),
      ),
    };
    const runs = {
      create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => row),
      findOne: jest.fn().mockResolvedValue(opts.existingRun ?? null),
    };
    const assets = {
      create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => row),
    };
    const relations = {
      findOne: jest.fn().mockResolvedValue(
        opts.existingRun
          ? { recording_id: 'rec-existing', source_id: originKey }
          : null,
      ),
      findAll: jest.fn().mockResolvedValue(opts.knownRelations ?? []),
      create: jest.fn().mockImplementation(async (row: Record<string, unknown>) => row),
    };
    const worker = opts.worker === undefined
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
      port, products, moduleSettings, admission, projects, policies,
      recordings, runs, assets, relations, worker, sequelize,
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
    const { port, admission, recordings, runs, assets, relations, worker } = createPort();

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
      expect.objectContaining({ source_kind: 'hangup_origin', source_id: originKey }),
      expect.anything(),
    );
    // Worker is fire-and-forget — processJob scheduled, hangup does not await STT
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
});
