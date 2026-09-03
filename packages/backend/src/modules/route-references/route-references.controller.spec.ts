import { BadRequestException } from '@nestjs/common';
import { RouteReferencesController } from './route-references.controller';

describe('RouteReferencesController', () => {
  let controller: RouteReferencesController;
  let service: { findUsage: jest.Mock };

  beforeEach(() => {
    service = {
      findUsage: jest.fn().mockResolvedValue({
        references: [{ routeUid: 5, actionOrBindingId: 'to-ivr-7', location: 'Route 5 action to-ivr-7' }],
        hasRawDialplanRoutes: false,
        meta: { hasRawDialplanRoutes: false },
      }),
    };
    controller = new RouteReferencesController(service as any);
  });

  it('GET /route-references/ivr/:uid uses JWT vpbx_user_uid only', async () => {
    const result = await controller.getUsage('ivr', '7', {
      user: { vpbx_user_uid: 100 },
    });
    expect(service.findUsage).toHaveBeenCalledWith('ivr', 7, 100);
    expect(result.references[0].routeUid).toBe(5);
  });

  it('rejects an unknown kind', async () => {
    await expect(
      controller.getUsage('tolist', '1', { user: { vpbx_user_uid: 100 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.findUsage).not.toHaveBeenCalled();
  });

  it('never accepts tenant uid from the path — only JWT', async () => {
    await controller.getUsage('queue', 'q100', { user: { vpbx_user_uid: 42 } });
    expect(service.findUsage).toHaveBeenCalledWith('queue', 'q100', 42);
  });
});
