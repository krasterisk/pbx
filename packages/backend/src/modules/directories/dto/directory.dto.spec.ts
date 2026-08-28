import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CallValueSourceDto, RouteDirectoryBindingDto } from './directory.dto';

async function validateSource(plain: Record<string, unknown>) {
  const dto = plainToInstance(CallValueSourceDto, plain);
  return validate(dto);
}

async function validateBindingSource(plain: Record<string, unknown>) {
  const dto = plainToInstance(RouteDirectoryBindingDto, {
    directory_uid: 1,
    position: 0,
    key_source: plain,
    match_mode: 'on_match',
    behavior_type: 'drop',
  });
  return validate(dto);
}

describe('CallValueSourceDto', () => {
  it.each([
    { source: 'fixed', value: '100' },
    { source: 'route_pattern' },
    { source: 'variable', name: 'EXTEN' },
    { source: 'original_caller' },
    { source: 'current_caller' },
  ])('accepts $source', async (plain) => {
    const errors = await validateSource(plain);
    expect(errors).toHaveLength(0);
  });

  it('rejects fixed without value', async () => {
    const errors = await validateSource({ source: 'fixed' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'value')).toBe(true);
  });

  it('rejects variable without name', async () => {
    const errors = await validateSource({ source: 'variable' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it("rejects source: 'phonebook'", async () => {
    const errors = await validateSource({ source: 'phonebook' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });

  it('rejects unknown source', async () => {
    const errors = await validateSource({ source: 'nope' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });

  it.each([
    { source: 'route_pattern', value: '100' },
    { source: 'original_caller', value: '100' },
    { source: 'current_caller', name: 'EXTEN' },
  ])('rejects extra value/name on $source', async (plain) => {
    const errors = await validateBindingSource(plain);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'key_source')).toBe(true);
  });
});
