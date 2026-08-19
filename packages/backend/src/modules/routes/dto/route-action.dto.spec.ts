import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, validateSync } from 'class-validator';
import { RouteActionDto } from './route-action.dto';
import { ToQueueParamsDto } from './dialplan-params/toqueue.params.dto';

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

describe('ToQueueParamsDto', () => {
  it('rejects target.source outside the allowed set', () => {
    const dto = plainToInstance(ToQueueParamsDto, { target: { source: 'nope' } });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects source fixed with empty value', () => {
    const dto = plainToInstance(ToQueueParamsDto, { target: { source: 'fixed', value: '' } });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('accepts source route_pattern without value', () => {
    const dto = plainToInstance(ToQueueParamsDto, { target: { source: 'route_pattern' } });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects phonebookUid 0', () => {
    const dto = plainToInstance(ToQueueParamsDto, { target: { source: 'phonebook', phonebookUid: 0 } });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});

describe('RouteActionDto toqueue params', () => {
  it('does not attach __toQueueErrors onto the action object', async () => {
    const dto = plainToInstance(RouteActionDto, {
      id: 'a1',
      type: 'toqueue',
      params: { target: { source: 'fixed', value: '' }, options: 'thH' },
      condition: {},
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(dto).not.toHaveProperty('__toQueueErrors');
  });
});
