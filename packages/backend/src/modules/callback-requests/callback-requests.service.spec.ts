import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CallbackRequestsService } from './callback-requests.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    uid: 1,
    user_uid: 100,
    caller: '79001112233',
    route_uid: 9,
    queue_uid: 7,
    queue_name: 'sales',
    status: 'pending',
    attempt_count: 0,
    max_attempts: 3,
    next_attempt_at: new Date('2026-09-03T10:00:00Z'),
    window_start: '09:00',
    window_end: '21:00',
    claimed_agent_uid: null,
    source: 'queue_dtmf',
    created_at: new Date('2026-09-03T09:00:00Z'),
    ...overrides,
  };
}

describe('CallbackRequestsService operator REST (D-42 D-50)', () => {
  let requests: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let agentQueues: { findAll: jest.Mock };
  let users: { findAll: jest.Mock; findOne: jest.Mock };
  let routes: { findAll: jest.Mock };
  let service: CallbackRequestsService;

  beforeEach(() => {
    requests = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue([1]),
    };
    agentQueues = { findAll: jest.fn().mockResolvedValue([{ queue_name: 'sales' }]) };
    users = {
      findAll: jest.fn().mockResolvedValue([{ uniqueid: 7, name: 'Ivan Petrov' }]),
      findOne: jest.fn().mockResolvedValue({ uniqueid: 7, name: 'Ivan Petrov' }),
    };
    routes = { findAll: jest.fn().mockResolvedValue([{ uid: 9, name: 'Inbound sales' }]) };
    service = new CallbackRequestsService(
      requests as any,
      agentQueues as any,
      users as any,
      routes as any,
    );
  });

  it('listForAgent returns only JWT-tenant rows in the agent queue memberships', async () => {
    requests.findAll.mockResolvedValue([row(), row({ uid: 2, queue_name: 'sales' })]);

    const items = await service.listForAgent(100, 7, 'active');

    expect(agentQueues.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_uid: 100, user_id: 7 }),
      }),
    );
    expect(requests.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_uid: 100 }),
      }),
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: 1,
        caller: '79001112233',
        queue_label: 'sales',
        route_label: 'Inbound sales',
        status: 'pending',
        attempt_count: 0,
        max_attempts: 3,
        window_start: '09:00',
        window_end: '21:00',
        claimed_agent: null,
        source: 'queue_dtmf',
      }),
    );
    expect(items[0]).toHaveProperty('next_attempt_at');
    expect(items[0]).toHaveProperty('created_at');
  });

  it('listForSupervisor returns tenant rows and never another tenant', async () => {
    requests.findAll.mockResolvedValue([row({ uid: 4, claimed_agent_uid: 7 })]);

    const items = await service.listForSupervisor(100, 'active');

    expect(requests.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_uid: 100 }),
      }),
    );
    expect(agentQueues.findAll).not.toHaveBeenCalled();
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: 4,
        claimed_agent: 'Ivan Petrov',
        claimed_agent_uid: 7,
      }),
    );
  });

  it('claim sets claimed_agent_uid from JWT and conflicts on a second claim', async () => {
    requests.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([0]);
    requests.findOne.mockResolvedValue(row({ claimed_agent_uid: 7 }));

    const first = await service.claim(100, 7, 1);
    expect(first).toEqual(expect.objectContaining({ id: 1, claimed_agent_uid: 7 }));
    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({ claimed_agent_uid: 7 }),
      expect.objectContaining({
        where: expect.objectContaining({
          uid: 1,
          user_uid: 100,
          claimed_agent_uid: null,
        }),
      }),
    );

    await expect(service.claim(100, 8, 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('claim 404s when the row belongs to another tenant', async () => {
    requests.update.mockResolvedValue([0]);
    requests.findOne.mockResolvedValue(null);

    await expect(service.claim(100, 7, 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('supervisor cancel updates any tenant row', async () => {
    requests.findOne.mockResolvedValue(row({ queue_name: 'vip' }));
    requests.update.mockResolvedValue([1]);

    const result = await service.cancel(100, 3, 1, true);
    expect(result).toEqual(expect.objectContaining({ id: 1, status: 'cancelled' }));
    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' }),
      expect.objectContaining({
        where: expect.objectContaining({ uid: 1, user_uid: 100 }),
      }),
    );
  });

  it('operator cancel is allowed only for own-queue pending rows', async () => {
    requests.findOne.mockResolvedValue(row({ status: 'pending', queue_name: 'sales' }));
    requests.update.mockResolvedValue([1]);

    await service.cancel(100, 7, 1, false);
    expect(requests.update).toHaveBeenCalled();
  });

  it('operator cancel of another queue is forbidden', async () => {
    agentQueues.findAll.mockResolvedValue([{ queue_name: 'sales' }]);
    requests.findOne.mockResolvedValue(row({ queue_name: 'vip' }));

    await expect(service.cancel(100, 7, 1, false)).rejects.toBeInstanceOf(ForbiddenException);
    expect(requests.update).not.toHaveBeenCalled();
  });
});
