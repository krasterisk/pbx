import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { createRoutesValidationPipe, UpdateRouteDto } from './dto/route-action.dto';

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
