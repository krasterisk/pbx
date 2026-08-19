import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QUEUESTATUS_VALUES } from '@krasterisk/shared';
import { RouteConditionDto } from './route-condition.dto';

async function validateCondition(plain: Record<string, unknown>) {
  const dto = plainToInstance(RouteConditionDto, plain);
  return validate(dto);
}

describe('RouteConditionDto (D-22)', () => {
  it('accepts QUEUESTATUS FULL and rejects DIALSTATUS value NOANSWER', async () => {
    expect(QUEUESTATUS_VALUES).not.toContain('NOANSWER');
    const ok = await validateCondition({ source: 'queuestatus', values: ['FULL'] });
    expect(ok).toHaveLength(0);

    const bad = await validateCondition({ source: 'queuestatus', values: ['NOANSWER'] });
    expect(bad.length).toBeGreaterThan(0);
  });

  it('rejects injected variable names and accepts a safe name', async () => {
    const bad = await validateCondition({
      source: 'variable',
      name: '${EVIL}; exten',
      op: 'eq',
      value: '1',
    });
    expect(bad.length).toBeGreaterThan(0);

    const ok = await validateCondition({
      source: 'variable',
      name: 'MY_VAR',
      op: 'eq',
      value: '1',
    });
    expect(ok).toHaveLength(0);
  });

  it('accepts legacy dialstatus-only payloads without source', async () => {
    const errors = await validateCondition({ dialstatus: 'ANSWER' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown device_state device string', async () => {
    const bad = await validateCondition({
      source: 'device_state',
      device: 'not a device; Goto(evil)',
      values: ['BUSY'],
    });
    expect(bad.length).toBeGreaterThan(0);

    const ok = await validateCondition({
      source: 'device_state',
      device: 'PJSIP/e101_42',
      values: ['BUSY'],
    });
    expect(ok).toHaveLength(0);
  });

  it('accepts http_result with a comparison value', async () => {
    const errors = await validateCondition({
      source: 'http_result',
      op: 'eq',
      value: 'ok',
    });
    expect(errors).toHaveLength(0);
  });
});
