import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { UserLevel } from '../users/user.model';
import { PlatformAiThreadsController } from './platform-threads.controller';

function httpCtx(level: number | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: level === undefined ? undefined : { level } }),
    }),
  } as any;
}

describe('PlatformAiThreadsController', () => {
  const threads = {
    listTenantThreads: jest.fn(),
    getTenantThread: jest.fn(),
    listMessages: jest.fn(),
  };
  const proposals = { findAll: jest.fn() };
  const workflows = { getOwned: jest.fn() };
  const users = { findAll: jest.fn() };
  let controller: PlatformAiThreadsController;

  const threadRow = {
    uid: 7,
    user_uid: 8,
    title: 'IVR',
    status: 'active' as const,
    last_message_at: new Date('2026-09-08T10:00:00Z'),
    created_at: new Date('2026-09-08T09:00:00Z'),
    updated_at: new Date('2026-09-08T10:00:00Z'),
    vpbx_user_uid: 42,
  };

  const proposalRow = {
    proposal_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    entity_type: 'ivr',
    entity_label: 'Продажи',
    summary: ['IVR Продажи'],
    before_json: null,
    after_json: { name: 'Продажи' },
    includes_dialplan_reload: true,
    status: 'pending',
    expires_at: new Date('2026-09-09T10:00:00Z'),
    applied_at: null,
    error: null,
  };

  const threadMessages = [
    {
      uid: 1,
      thread_uid: 7,
      role: 'user' as const,
      content: 'Создай IVR',
      tool_name: null,
      tool_calls: null,
      proposal_id: null,
      visibility: 'public',
      created_at: new Date('2026-09-08T10:00:00Z'),
    },
    {
      uid: 2,
      thread_uid: 7,
      role: 'tool' as const,
      content: '{"proposalId":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","apply_payload":{"tool":"create_ivr"}}',
      tool_name: 'create_ivr',
      tool_calls: [{ id: 'call_1', name: 'create_ivr' }],
      proposal_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      visibility: 'public',
      created_at: new Date('2026-09-08T10:00:01Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    proposals.findAll.mockResolvedValue([]);
    workflows.getOwned.mockRejectedValue(new NotFoundException('Workflow not found'));
    users.findAll.mockResolvedValue([]);
    threads.listTenantThreads.mockResolvedValue([]);
    threads.listMessages.mockResolvedValue([]);
    controller = new PlatformAiThreadsController(
      threads as any,
      proposals as any,
      workflows as any,
      users as any,
    );
  });

  it('guards the controller with JWT and SuperAdmin', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PlatformAiThreadsController) ?? [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, SuperAdminGuard]));
  });

  it.each([
    ['ADMIN', UserLevel.ADMIN],
    ['OPERATOR', UserLevel.OPERATOR],
    ['SUPERVISOR', UserLevel.SUPERVISOR],
    ['READONLY', UserLevel.READONLY],
  ])('SuperAdminGuard forbids a %s caller', (_name, level) => {
    const guard = new SuperAdminGuard();
    expect(() => guard.canActivate(httpCtx(level))).toThrow(ForbiddenException);
  });

  it('lists tenant threads with an owner name and a read-only flag', async () => {
    threads.listTenantThreads.mockResolvedValue([threadRow]);
    users.findAll.mockResolvedValue([{ uniqueid: 8, name: 'Пётр', login: 'petr' }]);

    const rows = await controller.listThreads(42);

    expect(threads.listTenantThreads).toHaveBeenCalledWith(42);
    expect(users.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vpbx_user_uid: 42 }),
      }),
    );
    expect(rows[0]).toEqual(expect.objectContaining({
      uid: 7,
      title: 'IVR',
      ownerName: 'Пётр',
      readOnly: true,
    }));
    expect(JSON.stringify(rows)).not.toMatch(/vpbx_user_uid|user_uid/);
  });

  it('takes the tenant from the path, not from the token', async () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, 'platform-threads.controller.ts'),
      'utf8',
    );
    expect(src).toMatch(/@Param\('tenantUid'/);
    expect(src).not.toMatch(/req\.user\.vpbx_user_uid/);

    threads.listTenantThreads.mockResolvedValue([]);
    await controller.listThreads(42);
    expect(threads.listTenantThreads).toHaveBeenCalledWith(42);
    expect(threads.listTenantThreads).not.toHaveBeenCalledWith(99);
  });

  it('returns a thread detail as read-only with a timeline and cards', async () => {
    threads.getTenantThread.mockResolvedValue(threadRow);
    threads.listMessages.mockResolvedValue(threadMessages);
    users.findAll.mockResolvedValue([{ uniqueid: 8, name: 'Пётр', login: 'petr' }]);
    proposals.findAll.mockResolvedValue([proposalRow]);

    const detail = await controller.getThread(42, 7);

    expect(threads.getTenantThread).toHaveBeenCalledWith(7, 42);
    expect(threads.listMessages).toHaveBeenCalledWith(7, 42, 8);
    expect(detail.readOnly).toBe(true);
    expect(detail.ownerName).toBe('Пётр');
    expect(detail).toHaveProperty('timeline');
    expect(detail).toHaveProperty('cards');
    expect(JSON.stringify(detail.timeline)).not.toMatch(/proposalId|apply_payload|tool_calls/);
    expect(proposals.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_uid: 8, vpbx_user_uid: 42 }),
      }),
    );
  });

  it('does not find a thread of another tenant', async () => {
    threads.getTenantThread.mockRejectedValue(new NotFoundException('Thread not found'));

    await expect(controller.getThread(99, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(threads.getTenantThread).toHaveBeenCalledWith(7, 99);
    expect(threads.listMessages).not.toHaveBeenCalled();
  });
});
