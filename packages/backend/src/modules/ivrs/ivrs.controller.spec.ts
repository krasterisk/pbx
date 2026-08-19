import { BadRequestException } from '@nestjs/common';
import { IvrsController } from './ivrs.controller';

describe('IvrsController write-path params validation', () => {
  let controller: IvrsController;
  let ivrsService: { create: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    ivrsService = {
      create: jest.fn().mockResolvedValue({ uid: 1 }),
      update: jest.fn().mockResolvedValue({ uid: 1 }),
    };
    controller = new IvrsController(ivrsService as any, {} as any);
  });

  it('PUT with invalid menu_items action returns 400 { errors }', async () => {
    await expect(
      controller.update(3, {
        menu_items: [{
          digit: '1',
          actions: [{ id: 'ivr-bad', type: 'toexten', params: { target: { source: 'fixed', value: '' } } }],
        }],
      } as any, { user: { vpbx_user_uid: 1, level: 1 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ivrsService.update).not.toHaveBeenCalled();
  });

  it('regression: valid IVR update still reaches the service', async () => {
    await controller.update(3, {
      menu_items: [{
        digit: '1',
        actions: [{ id: 'ivr-ok', type: 'hangup', params: {} }],
      }],
    } as any, { user: { vpbx_user_uid: 1, level: 1 } });
    expect(ivrsService.update).toHaveBeenCalled();
  });
});
