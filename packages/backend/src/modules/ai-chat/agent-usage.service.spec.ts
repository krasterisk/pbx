import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserLevel } from '../users/user.model';
import { AgentUsageController } from './agent-usage.controller';
import { AgentUsageService } from './agent-usage.service';

const FROM = new Date('2026-08-01T00:00:00.000Z');
const TO = new Date('2026-08-31T23:59:59.000Z');

function httpCtx(level: number | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: level === undefined ? undefined : { level } }),
    }),
  } as any;
}

describe('AgentUsageService (15-24 / D-07 / D-08)', () => {
  let threads: { findAll: jest.Mock };
  let providers: { findAll: jest.Mock };
  let service: AgentUsageService;

  beforeEach(() => {
    threads = { findAll: jest.fn() };
    providers = { findAll: jest.fn() };
    service = new AgentUsageService(threads as any, providers as any);
  });

  it('returns per-tenant input/output token totals and turns over a date range', async () => {
    threads.findAll.mockResolvedValue([
      { vpbx_user_uid: 10, provider_uid: 1, tokens_in: 100, tokens_out: 40 },
      { vpbx_user_uid: 10, provider_uid: 1, tokens_in: 20, tokens_out: 10 },
      { vpbx_user_uid: 20, provider_uid: 1, tokens_in: 5, tokens_out: 1 },
    ]);
    providers.findAll.mockResolvedValue([
      { uid: 1, pricing: { inputTokenUsd: 0.15e-6, outputTokenUsd: 0.6e-6, currency: 'USD' } },
    ]);

    const rows = await service.queryTenantUsage(FROM, TO);

    expect(threads.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          last_message_at: expect.anything(),
        }),
      }),
    );
    const tenant10 = rows.find((row) => row.tenantUid === 10);
    const tenant20 = rows.find((row) => row.tenantUid === 20);
    expect(tenant10).toEqual(
      expect.objectContaining({ tenantUid: 10, tokensIn: 120, tokensOut: 50, turns: 2 }),
    );
    expect(tenant20).toEqual(
      expect.objectContaining({ tenantUid: 20, tokensIn: 5, tokensOut: 1, turns: 1 }),
    );
  });

  it('computes spend from the provider pricing fields', async () => {
    threads.findAll.mockResolvedValue([
      { vpbx_user_uid: 10, provider_uid: 1, tokens_in: 1_000_000, tokens_out: 1_000_000 },
    ]);
    providers.findAll.mockResolvedValue([
      { uid: 1, pricing: { inputTokenUsd: 0.15e-6, outputTokenUsd: 0.6e-6, currency: 'USD' } },
    ]);

    const [row] = await service.queryTenantUsage(FROM, TO);

    expect(row.spendAvailable).toBe(true);
    expect(row.spendUsd).toBeCloseTo(0.75, 8);
  });

  it('reports spend as unavailable rather than zero when pricing is absent', async () => {
    threads.findAll.mockResolvedValue([
      { vpbx_user_uid: 10, provider_uid: 1, tokens_in: 100, tokens_out: 50 },
    ]);
    providers.findAll.mockResolvedValue([{ uid: 1, pricing: { currency: 'USD' } }]);

    const [row] = await service.queryTenantUsage(FROM, TO);

    expect(row.spendAvailable).toBe(false);
    expect(row.spendUsd).toBeNull();
    expect(row.spendUsd).not.toBe(0);
  });

  it('treats explicit zero pricing as available zero spend, not missing data', async () => {
    threads.findAll.mockResolvedValue([
      { vpbx_user_uid: 10, provider_uid: 1, tokens_in: 100, tokens_out: 50 },
    ]);
    providers.findAll.mockResolvedValue([
      { uid: 1, pricing: { inputTokenUsd: 0, outputTokenUsd: 0, currency: 'USD' } },
    ]);

    const [row] = await service.queryTenantUsage(FROM, TO);

    expect(row.spendAvailable).toBe(true);
    expect(row.spendUsd).toBe(0);
  });

  it('reads conversation rows and never the voice call-record table', async () => {
    threads.findAll.mockResolvedValue([]);
    providers.findAll.mockResolvedValue([]);

    await service.queryTenantUsage(FROM, TO);

    expect(threads.findAll).toHaveBeenCalled();
    const source = require('fs').readFileSync(require('path').join(__dirname, 'agent-usage.service.ts'), 'utf8');
    expect(source).not.toMatch(/CcAiCdr|cc_ai_cdr|call.?record/i);
  });

  it('returns figures for every tenant that has conversation activity in the window', async () => {
    threads.findAll.mockResolvedValue([
      { vpbx_user_uid: 3, provider_uid: 1, tokens_in: 1, tokens_out: 1 },
      { vpbx_user_uid: 9, provider_uid: 1, tokens_in: 2, tokens_out: 2 },
    ]);
    providers.findAll.mockResolvedValue([
      { uid: 1, pricing: { inputTokenUsd: 1, outputTokenUsd: 1 } },
    ]);

    const rows = await service.queryTenantUsage(FROM, TO);
    expect(rows.map((row) => row.tenantUid).sort()).toEqual([3, 9]);
  });
});

describe('AgentUsageController administrator gate (D-07 / T-15-108)', () => {
  it('guards the controller with JWT and SuperAdmin so a tenant-role caller is forbidden', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AgentUsageController) ?? [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, SuperAdminGuard]));
  });

  it.each([
    ['ADMIN', UserLevel.ADMIN],
    ['OPERATOR', UserLevel.OPERATOR],
    ['SUPERVISOR', UserLevel.SUPERVISOR],
    ['READONLY', UserLevel.READONLY],
  ])('SuperAdminGuard forbids a %s caller on every usage endpoint', (_name, level) => {
    const guard = new SuperAdminGuard();
    expect(() => guard.canActivate(httpCtx(level))).toThrow(ForbiddenException);
  });

  it('SuperAdminGuard allows a platform-administrator caller', () => {
    const guard = new SuperAdminGuard();
    expect(guard.canActivate(httpCtx(UserLevel.SUPERADMIN))).toBe(true);
  });

  it('exposes a usage query that a platform administrator can call', async () => {
    const usage = { queryTenantUsage: jest.fn().mockResolvedValue([{ tenantUid: 10, tokensIn: 1, tokensOut: 1, turns: 1, spendUsd: 0, spendAvailable: true }]) };
    const controller = new AgentUsageController(usage as any);
    const result = await controller.getUsage(FROM.toISOString(), TO.toISOString());
    expect(usage.queryTenantUsage).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].tenantUid).toBe(10);
  });
});

describe('AgentUsageService monitoring (15-24 Task 2)', () => {
  let threads: { findAll: jest.Mock };
  let providers: { findAll: jest.Mock };
  let proposals: { findAll: jest.Mock };
  let audit: { findAll: jest.Mock };
  let service: AgentUsageService;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    threads = { findAll: jest.fn() };
    providers = { findAll: jest.fn() };
    proposals = { findAll: jest.fn() };
    audit = { findAll: jest.fn() };
    service = new AgentUsageService(threads as any, providers as any, proposals as any, audit as any);
    errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns pending, applied, rejected and denied proposal counts per tenant', async () => {
    proposals.findAll.mockResolvedValue([
      { vpbx_user_uid: 10, status: 'pending' },
      { vpbx_user_uid: 10, status: 'applied' },
      { vpbx_user_uid: 10, status: 'applied' },
      { vpbx_user_uid: 10, status: 'rejected' },
      { vpbx_user_uid: 10, status: 'denied' },
      { vpbx_user_uid: 20, status: 'pending' },
    ]);

    const rows = await service.queryProposalFunnel(FROM, TO);

    expect(proposals.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ created_at: expect.anything() }) }),
    );
    expect(rows.find((row) => row.tenantUid === 10)).toEqual({
      tenantUid: 10,
      pending: 1,
      applied: 2,
      rejected: 1,
      denied: 1,
    });
    expect(rows.find((row) => row.tenantUid === 20)).toEqual({
      tenantUid: 20,
      pending: 1,
      applied: 0,
      rejected: 0,
      denied: 0,
    });
  });

  it('returns tool invocation counts by status and tool name per tenant', async () => {
    audit.findAll.mockResolvedValue([
      { user_uid: 10, tool_name: 'create_route', status: 'ok' },
      { user_uid: 10, tool_name: 'create_route', status: 'error' },
      { user_uid: 10, tool_name: 'get_pbx_state', status: 'ok' },
      { user_uid: 20, tool_name: 'create_route', status: 'error' },
    ]);

    const rows = await service.queryToolErrors(FROM, TO);

    expect(audit.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ created_at: expect.anything() }) }),
    );
    expect(rows).toEqual(expect.arrayContaining([
      { tenantUid: 10, toolName: 'create_route', status: 'ok', count: 1 },
      { tenantUid: 10, toolName: 'create_route', status: 'error', count: 1 },
      { tenantUid: 10, toolName: 'get_pbx_state', status: 'ok', count: 1 },
      { tenantUid: 20, toolName: 'create_route', status: 'error', count: 1 },
    ]));
  });

  it('reports a mutating audit row with no matching applied proposal', async () => {
    audit.findAll.mockResolvedValue([
      { uid: 77, user_uid: 10, thread_uid: 3, tool_name: 'create_route', created_at: FROM },
    ]);
    proposals.findAll.mockResolvedValue([]);

    const hits = await service.detectSilentWrites(FROM, TO);

    expect(hits).toEqual([
      expect.objectContaining({ tenantUid: 10, toolName: 'create_route', auditUid: 77 }),
    ]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/10/));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/create_route/));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/77/));
  });

  it('yields an empty detector result when every mutation has an applied proposal', async () => {
    audit.findAll.mockResolvedValue([
      { uid: 77, user_uid: 10, thread_uid: 3, tool_name: 'create_route', created_at: FROM },
    ]);
    proposals.findAll.mockResolvedValue([
      { vpbx_user_uid: 10, thread_uid: 3, status: 'applied', applied_at: FROM },
    ]);

    const hits = await service.detectSilentWrites(FROM, TO);

    expect(hits).toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
