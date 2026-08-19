import { BadRequestException } from '@nestjs/common';
import { VoiceRobotsController } from './voice-robots.controller';

describe('VoiceRobotsController write-path params validation', () => {
  let controller: VoiceRobotsController;
  let service: {
    updateRobot: jest.Mock;
    createRobot: jest.Mock;
    updateKeyword: jest.Mock;
    createKeyword: jest.Mock;
  };

  beforeEach(() => {
    service = {
      updateRobot: jest.fn().mockResolvedValue({ uid: 1 }),
      createRobot: jest.fn().mockResolvedValue({ uid: 1 }),
      updateKeyword: jest.fn().mockResolvedValue({ uid: 1 }),
      createKeyword: jest.fn().mockResolvedValue({ uid: 1 }),
    };
    controller = new VoiceRobotsController(service as any);
  });

  it('PUT robot with invalid fallback_action returns 400 { errors }', async () => {
    await expect(
      controller.update({ user: { vpbx_user_uid: 1 } } as any, 4, {
        fallback_action: { id: 'fb-bad', type: 'toexten', params: { target: { source: 'fixed', value: '' } } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.updateRobot).not.toHaveBeenCalled();
  });

  it('PUT keyword with invalid actions returns 400 { errors }', async () => {
    await expect(
      controller.updateKeyword({ user: { vpbx_user_uid: 1 } } as any, 8, {
        actions: [{ id: 'kw-bad', type: 'toexten', params: { target: { source: 'fixed', value: '' } } }],
      }),
    ).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ actionId: 'kw-bad' })] },
    });
    expect(service.updateKeyword).not.toHaveBeenCalled();
  });
});
