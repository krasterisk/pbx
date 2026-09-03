import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { CallbackRequestsController } from './callback-requests.controller';

describe('CallbackRequestsController', () => {
  let service: {
    listForAgent: jest.Mock;
    listForSupervisor: jest.Mock;
    claim: jest.Mock;
    cancel: jest.Mock;
  };
  let controller: CallbackRequestsController;

  const operatorReq = {
    user: { vpbx_user_uid: 100, sub: 7, level: UserLevel.OPERATOR },
  };
  const supervisorReq = {
    user: { vpbx_user_uid: 100, sub: 3, level: UserLevel.SUPERVISOR },
  };

  beforeEach(() => {
    service = {
      listForAgent: jest.fn().mockResolvedValue([]),
      listForSupervisor: jest.fn().mockResolvedValue([]),
      claim: jest.fn().mockResolvedValue({ id: 1, claimed_agent_uid: 7 }),
      cancel: jest.fn().mockResolvedValue({ id: 1, status: 'cancelled' }),
    };
    controller = new CallbackRequestsController(service as any);
  });

  it('lists with JWT tenant only and ignores query tenant ids', async () => {
    await controller.list(operatorReq as any, {
      status: 'active',
      tenant: '999',
      user_uid: '999',
      vpbx_user_uid: '999',
    } as any);

    expect(service.listForAgent).toHaveBeenCalledWith(100, 7, 'active');
    expect(service.listForAgent).not.toHaveBeenCalledWith(999, expect.anything(), expect.anything());
    expect(service.listForSupervisor).not.toHaveBeenCalled();
  });

  it('routes supervisor list to listForSupervisor without a queue filter param', async () => {
    await controller.list(supervisorReq as any, {
      status: 'completed',
      queues: 'sales,support',
    } as any);

    expect(service.listForSupervisor).toHaveBeenCalledWith(100, 'completed');
    expect(service.listForAgent).not.toHaveBeenCalled();
  });

  it('claims with JWT sub and tenant, never body agent id', async () => {
    await controller.claim(11, {
      user: { vpbx_user_uid: 100, sub: 7, level: UserLevel.OPERATOR },
      body: { claimed_agent_uid: 99, agent_id: 99 },
    } as any);

    expect(service.claim).toHaveBeenCalledWith(100, 7, 11);
  });

  it('surfaces claim 409 when the row is already claimed', async () => {
    service.claim.mockRejectedValue(
      new ConflictException({ message: 'Callback request already claimed' }),
    );

    await expect(controller.claim(11, operatorReq as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancels as supervisor when JWT level is supervisor', async () => {
    await controller.cancel(11, supervisorReq as any);
    expect(service.cancel).toHaveBeenCalledWith(100, 3, 11, true);
  });

  it('cancels as operator (not supervisor) for OPERATOR level', async () => {
    await controller.cancel(11, operatorReq as any);
    expect(service.cancel).toHaveBeenCalledWith(100, 7, 11, false);
  });

  it('surfaces ForbiddenException from operator cancel of another queue', async () => {
    service.cancel.mockRejectedValue(new ForbiddenException('Not allowed to cancel this request'));
    await expect(controller.cancel(11, operatorReq as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
