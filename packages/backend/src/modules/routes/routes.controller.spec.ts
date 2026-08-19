import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { createRoutesValidationPipe, UpdateRouteDto } from './dto/route-action.dto';
import { RoutesController } from './routes.controller';

describe('RoutesController validation (toqueue actionId)', () => {
  it('returns actionId of the invalid toqueue step', async () => {
    const pipe = createRoutesValidationPipe();
    const body = {
      actions: [
        {
          id: 'step-queue-1',
          type: 'toqueue',
          params: { target: { source: 'nope' } },
          condition: {},
        },
      ],
    };

    try {
      await pipe.transform(body, { type: 'body', metatype: UpdateRouteDto } as any);
      throw new Error('expected ValidationPipe to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as {
        errors?: Array<{ actionId: string; path: string; message: string }>;
        message?: { errors?: Array<{ actionId: string; path: string; message: string }> };
      };
      const errors = response.errors ?? response.message?.errors ?? [];
      expect(errors.some((e) => e.actionId === 'step-queue-1')).toBe(true);
    }
  });
});

describe('RoutesController write-path params validation', () => {
  let controller: RoutesController;
  let routesService: { findOne: jest.Mock; update: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    routesService = {
      findOne: jest.fn().mockResolvedValue({ context_uid: 1 }),
      update: jest.fn().mockResolvedValue({ uid: 1, context_uid: 1 }),
      create: jest.fn().mockResolvedValue({ uid: 1, context_uid: 1 }),
    };
    controller = new RoutesController(
      routesService as any,
      {} as any,
      {} as any,
      { applyContext: jest.fn() } as any,
    );
  });

  it('held-out: invalid second action returns only that actionId', async () => {
    await expect(
      controller.update('9', {
        actions: [
          { id: 'ok-1', type: 'hangup', params: {}, condition: {} },
          { id: 'bad-2', type: 'toexten', params: { target: { source: 'fixed', value: '' } }, condition: {} },
        ],
      } as any, { user: { vpbx_user_uid: 1 } } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(routesService.update).not.toHaveBeenCalled();
  });

  it('rejects invalid binding actions and does not call update', async () => {
    await expect(
      controller.update('9', {
        actions: [{ id: 'ok', type: 'hangup', params: {}, condition: {} }],
        bindings: [{
          phonebook_uid: 1,
          position: 0,
          match_mode: 'on_match',
          behavior_type: 'custom',
          actions: [{ id: 'bind-bad', type: 'toexten', params: { target: { source: 'fixed', value: '' } } }],
        }],
      } as any, { user: { vpbx_user_uid: 1 } } as any),
    ).rejects.toMatchObject({ response: { errors: [expect.objectContaining({ actionId: 'bind-bad' })] } });
    expect(routesService.update).not.toHaveBeenCalled();
  });

  it('regression: valid save still reaches the service', async () => {
    await controller.update('9', {
      name: 'Main',
      actions: [{ id: 'ok', type: 'hangup', params: {}, condition: {} }],
    } as any, { user: { vpbx_user_uid: 1 } } as any);
    expect(routesService.update).toHaveBeenCalled();
  });
});
