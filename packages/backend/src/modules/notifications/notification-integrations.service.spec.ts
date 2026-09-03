import { ConflictException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RouteReferencesService } from '../route-references/route-references.service';

describe('NotificationIntegrationsService.remove (D-48)', () => {
  it('throws 409 with references when a route notify action points at the integration', async () => {
    const destroy = jest.fn();
    const model = {
      findOne: jest.fn().mockResolvedValue({
        uid: 22,
        user_uid: 7,
        destroy,
        toJSON: () => ({ uid: 22, user_uid: 7 }),
      }),
    };
    const refs = new RouteReferencesService(
      {
        findAll: jest.fn().mockResolvedValue([
          {
            uid: 3,
            actions: [{ id: 'n1', type: 'notify', params: { integration_uid: 22 } }],
          },
        ]),
      } as any,
      { findAll: jest.fn().mockResolvedValue([]) } as any,
    );
    const service = new NotificationsService(model as any, refs);

    try {
      await service.remove(22, 7);
      throw new Error('expected remove to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const body = (err as ConflictException).getResponse() as {
        message?: string;
        references?: Array<{ routeUid: unknown; actionOrBindingId: unknown }>;
      };
      expect(body.message).toBe('Notification integration is referenced and cannot be deleted');
      expect(body.references?.[0]).toEqual(
        expect.objectContaining({ routeUid: 3, actionOrBindingId: 'n1' }),
      );
    }
    expect(destroy).not.toHaveBeenCalled();
  });
});
