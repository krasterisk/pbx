import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, validateSync } from 'class-validator';
import { RouteActionDto, RouteDirectoryBindingDto } from './route-action.dto';
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
    it.each(['notify', 'callerid'])(
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

  it('rejects leftover phonebook ValueSource', () => {
    const dto = plainToInstance(ToQueueParamsDto, {
      target: { source: 'phonebook', phonebookUid: 5, varKey: 'queue' },
    });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects directory without valueFieldUid', () => {
    const dto = plainToInstance(ToQueueParamsDto, {
      target: {
        source: 'directory',
        directoryUid: 5,
        keySource: { source: 'original_caller' },
        onMissing: 'skip',
      },
    });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('accepts directory with directoryUid, keySource, valueFieldUid, and onMissing', () => {
    const dto = plainToInstance(ToQueueParamsDto, {
      target: {
        source: 'directory',
        directoryUid: 5,
        keySource: { source: 'original_caller' },
        valueFieldUid: 17,
        onMissing: 'skip',
      },
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});

describe('RouteDirectoryBindingDto', () => {
  async function validateBinding(plain: Record<string, unknown>) {
    const dto = plainToInstance(RouteDirectoryBindingDto, plain);
    return validate(dto);
  }

  const base = {
    directory_uid: 7,
    position: 0,
    key_source: { source: 'original_caller' },
    match_mode: 'on_match',
    behavior_type: 'drop',
  };

  it('requires directory_uid and key_source', async () => {
    const missingDir = await validateBinding({
      position: 0,
      key_source: { source: 'original_caller' },
      match_mode: 'on_match',
      behavior_type: 'drop',
    });
    expect(missingDir.some((e) => e.property === 'directory_uid')).toBe(true);

    const missingKey = await validateBinding({
      directory_uid: 7,
      position: 0,
      match_mode: 'on_match',
      behavior_type: 'drop',
    });
    expect(missingKey.some((e) => e.property === 'key_source')).toBe(true);
  });

  it('accepts a valid drop policy', async () => {
    const errors = await validateBinding(base);
    expect(errors).toHaveLength(0);
  });

  it('requires fieldUid for set_name when fixed is absent', async () => {
    const errors = await validateBinding({
      ...base,
      behavior_type: 'set_name',
      behavior_params: {},
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts set_name with fieldUid', async () => {
    const errors = await validateBinding({
      ...base,
      behavior_type: 'set_name',
      behavior_params: { fieldUid: 17 },
    });
    expect(errors).toHaveLength(0);
  });

  it('requires mappings with fieldUid for map_fields', async () => {
    const errors = await validateBinding({
      ...base,
      behavior_type: 'map_fields',
      behavior_params: { mappings: [] },
    });
    expect(errors.length).toBeGreaterThan(0);
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
