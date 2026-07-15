import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RouteActionDto } from './route-action.dto';

async function validateAction(plain: Record<string, unknown>) {
  const dto = plainToInstance(RouteActionDto, plain);
  return validate(dto);
}

function baseAction(type: string, condition: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    type,
    params: {},
    condition,
  };
}

describe('RouteActionDto', () => {
  describe('action types', () => {
    it.each(['notify', 'callerid', 'trunk_carousel'])(
      'accepts type "%s"',
      async (type) => {
        const errors = await validateAction(baseAction(type));
        expect(errors).toHaveLength(0);
      },
    );

    it('rejects unknown action type', async () => {
      const errors = await validateAction(baseAction('zzz'));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });
  });

  describe('condition.dialstatus', () => {
    it('accepts a single valid dialstatus', async () => {
      const errors = await validateAction(
        baseAction('notify', { dialstatus: 'ANSWER' }),
      );
      expect(errors).toHaveLength(0);
    });

    it('accepts an array of valid dialstatuses', async () => {
      const errors = await validateAction(
        baseAction('notify', { dialstatus: ['ANSWER', 'NOANSWER'] }),
      );
      expect(errors).toHaveLength(0);
    });

    it('rejects an array with an invalid dialstatus', async () => {
      const errors = await validateAction(
        baseAction('notify', { dialstatus: ['BOGUS'] }),
      );
      expect(errors.length).toBeGreaterThan(0);
      const conditionErrors = errors.find((e) => e.property === 'condition');
      expect(conditionErrors?.children?.some((c) => c.property === 'dialstatus')).toBe(true);
    });
  });

  describe('condition.time_group_uid', () => {
    it('accepts a numeric time_group_uid', async () => {
      const errors = await validateAction(
        baseAction('notify', { time_group_uid: 12 }),
      );
      expect(errors).toHaveLength(0);
    });

    it('rejects a non-numeric time_group_uid', async () => {
      const errors = await validateAction(
        baseAction('notify', { time_group_uid: 'x' }),
      );
      expect(errors.length).toBeGreaterThan(0);
      const conditionErrors = errors.find((e) => e.property === 'condition');
      expect(conditionErrors?.children?.some((c) => c.property === 'time_group_uid')).toBe(true);
    });
  });
});
