import { DialplanWebhooksService } from './dialplan-webhooks.service';
import * as pipeline from '../speech-analytics/pipeline';

jest.mock('../speech-analytics/pipeline', () => ({
  fakeStt: jest.fn(),
  runPipeline: jest.fn(),
}));

describe('DialplanWebhooksService handleOnHangup analytics enqueue (D-03)', () => {
  const projectId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4001';

  function createService(opts: {
    route: Record<string, unknown> | null;
    enqueueAnalysisJob?: jest.Mock;
    resolveHangupContext?: jest.Mock;
  }) {
    const routeModel = {
      findOne: jest.fn().mockResolvedValue(opts.route),
    };
    const config = {
      get: jest.fn((key: string) => (key === 'WEBHOOK_SECRET' ? '' : undefined)),
    };
    const webhookQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };
    const analyticsPort = {
      resolveHangupContext: opts.resolveHangupContext
        ?? jest.fn().mockResolvedValue({
          entitled: true,
          pauseNew: false,
          privacyDenied: false,
          recordingEnabled: true,
          projectActive: true,
          projectPublished: true,
          sameTenantProject: true,
          policyRevision: 1,
          nodeId: 'node-1',
          knownOrigins: new Set<string>(),
        }),
      enqueueAnalysisJob: opts.enqueueAnalysisJob ?? jest.fn().mockResolvedValue({ jobId: 'job-1' }),
    };
    const service = new DialplanWebhooksService(
      routeModel as any,
      config as any,
      webhookQueue as any,
      analyticsPort as any,
    );
    return { service, routeModel, webhookQueue, analyticsPort };
  }

  const hangupParams = {
    route_uid: '42',
    uniqueid: '1700000000.1',
    clid: '79001234567',
    duration: '45',
    disposition: 'ANSWERED',
    record_path: '8/calls/20260922/rec-1',
    user_uid: '8',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues an analysis job when entitled, not paused, and route has projectId', async () => {
    const enqueueAnalysisJob = jest.fn().mockResolvedValue({ jobId: 'job-1' });
    const { service, analyticsPort } = createService({
      route: {
        uid: 42,
        user_uid: 8,
        options: { record: true, analytics: { projectId } },
        webhooks: { on_hangup: 'https://crm.example/hangup' },
      },
      enqueueAnalysisJob,
    });

    await service.handleOnHangup(hangupParams);

    expect(analyticsPort.resolveHangupContext).toHaveBeenCalled();
    expect(enqueueAnalysisJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantUid: 8,
        projectId,
        uniqueid: hangupParams.uniqueid,
        recordPath: hangupParams.record_path,
      }),
    );
    expect(pipeline.fakeStt).not.toHaveBeenCalled();
    expect(pipeline.runPipeline).not.toHaveBeenCalled();
  });

  it('skips enqueue when route has no analytics projectId', async () => {
    const enqueueAnalysisJob = jest.fn();
    const { service } = createService({
      route: {
        uid: 42,
        user_uid: 8,
        options: { record: true },
        webhooks: null,
      },
      enqueueAnalysisJob,
    });

    await service.handleOnHangup(hangupParams);

    expect(enqueueAnalysisJob).not.toHaveBeenCalled();
    expect(pipeline.fakeStt).not.toHaveBeenCalled();
  });

  it('skips enqueue when pauseNew is true without cancelling prior jobs', async () => {
    const enqueueAnalysisJob = jest.fn();
    const { service } = createService({
      route: {
        uid: 42,
        user_uid: 8,
        options: { record: true, analytics: { projectId } },
        webhooks: null,
      },
      enqueueAnalysisJob,
      resolveHangupContext: jest.fn().mockResolvedValue({
        entitled: true,
        pauseNew: true,
        privacyDenied: false,
        recordingEnabled: true,
        projectActive: true,
        projectPublished: true,
        sameTenantProject: true,
        policyRevision: 1,
        nodeId: 'node-1',
        knownOrigins: new Set<string>(),
      }),
    });

    await service.handleOnHangup(hangupParams);

    expect(enqueueAnalysisJob).not.toHaveBeenCalled();
  });

  it('still delivers route webhook and does not await STT when analytics enqueues', async () => {
    const enqueueAnalysisJob = jest.fn().mockResolvedValue({ jobId: 'job-1' });
    const { service, webhookQueue } = createService({
      route: {
        uid: 42,
        user_uid: 8,
        options: { record: true, analytics: { projectId } },
        webhooks: { on_hangup: { url: 'https://crm.example/hangup' } },
      },
      enqueueAnalysisJob,
    });

    await service.handleOnHangup(hangupParams);

    expect(webhookQueue.enqueue).toHaveBeenCalled();
    expect(enqueueAnalysisJob).toHaveBeenCalled();
    expect(pipeline.runPipeline).not.toHaveBeenCalled();
  });

  it('skips enqueue when recording is off and record_path is empty', async () => {
    const enqueueAnalysisJob = jest.fn();
    const { service } = createService({
      route: {
        uid: 42,
        user_uid: 8,
        options: { record: false, analytics: { projectId } },
        webhooks: null,
      },
      enqueueAnalysisJob,
    });

    await service.handleOnHangup({ ...hangupParams, record_path: '' });

    expect(enqueueAnalysisJob).not.toHaveBeenCalled();
  });

  it('skips chargeable enqueue when knownOrigins already has the origin (idempotent)', async () => {
    const enqueueAnalysisJob = jest.fn();
    const knownKey = [
      8,
      'node-1',
      hangupParams.uniqueid,
      projectId,
      1,
    ].join(':');
    const { service } = createService({
      route: {
        uid: 42,
        user_uid: 8,
        options: { record: true, analytics: { projectId } },
        webhooks: null,
      },
      enqueueAnalysisJob,
      resolveHangupContext: jest.fn().mockResolvedValue({
        entitled: true,
        pauseNew: false,
        privacyDenied: false,
        recordingEnabled: true,
        projectActive: true,
        projectPublished: true,
        sameTenantProject: true,
        policyRevision: 1,
        nodeId: 'node-1',
        knownOrigins: new Set([knownKey]),
      }),
    });

    await service.handleOnHangup(hangupParams);

    expect(enqueueAnalysisJob).not.toHaveBeenCalled();
  });
});
