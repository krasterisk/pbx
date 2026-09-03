import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { RouteReferencesService } from '../route-references/route-references.service';

function makeRouteReferences(routes: Array<{ uid: number; actions?: unknown }> = []) {
  return new RouteReferencesService(
    { findAll: jest.fn().mockResolvedValue(routes) } as any,
    { findAll: jest.fn().mockResolvedValue([]) } as any,
  );
}

describe('QueuesService.remove (D-48)', () => {
  const vpbx = 42;
  const queueName = 'q100_42';

  function buildService(routes: Array<{ uid: number; actions?: unknown }> = []) {
    const destroy = jest.fn().mockResolvedValue(undefined);
    const queue = {
      name: queueName,
      user_uid: vpbx,
      destroy,
    };
    const queueModel = {
      findOne: jest.fn().mockResolvedValue(queue),
    };
    const memberModel = {
      destroy: jest.fn().mockResolvedValue(1),
    };
    const transaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    const sequelize = {
      transaction: jest.fn().mockResolvedValue(transaction),
    };
    const amiService = { command: jest.fn().mockResolvedValue(undefined) };
    const service = new QueuesService(
      queueModel as any,
      memberModel as any,
      sequelize as any,
      amiService as any,
      makeRouteReferences(routes),
    );
    return { service, queue, queueModel, memberModel, transaction };
  }

  it('throws 409 with references when a route toqueue action points at the queue', async () => {
    const { service, queue } = buildService([
      {
        uid: 8,
        actions: [{ id: 'to-q100', type: 'toqueue', params: { target: { source: 'fixed', value: 'q100' } } }],
      },
    ]);

    try {
      await service.remove(queueName, vpbx);
      throw new Error('expected remove to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const body = (err as ConflictException).getResponse() as {
        message?: string;
        references?: Array<{ routeUid: unknown; actionOrBindingId: unknown; location: unknown }>;
      };
      expect(body.message).toBe('Queue is referenced and cannot be deleted');
      expect(body.references?.[0]).toEqual(
        expect.objectContaining({
          routeUid: 8,
          actionOrBindingId: 'to-q100',
          location: expect.any(String),
        }),
      );
    }
    expect(queue.destroy).not.toHaveBeenCalled();
  });

  it('deletes when no route references the queue', async () => {
    const { service, queue, memberModel, transaction } = buildService();
    const result = await service.remove(queueName, vpbx);
    expect(result).toEqual({ success: true });
    expect(memberModel.destroy).toHaveBeenCalled();
    expect(queue.destroy).toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
  });

  it('throws NotFoundException when the queue is missing', async () => {
    const { service, queueModel } = buildService();
    queueModel.findOne.mockResolvedValueOnce(null);
    await expect(service.remove('missing', vpbx)).rejects.toBeInstanceOf(NotFoundException);
  });
});
