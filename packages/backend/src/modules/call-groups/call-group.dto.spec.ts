import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCallGroupDto } from './dto/call-group.dto';

function createDto(overrides: Record<string, unknown> = {}): CreateCallGroupDto {
  return plainToInstance(CreateCallGroupDto, {
    name: 'Sales',
    strategy: 'ringall',
    exten: '6007',
    ...overrides,
  });
}

describe('CreateCallGroupDto ring options (D-34)', () => {
  it('rejects dialOptions with an unclosed parenthesis (400)', async () => {
    const errors = await validate(createDto({ dialOptions: 'tTU(x' }));
    expect(errors.some((e) => e.property === 'dialOptions')).toBe(true);
  });

  it('accepts a balanced parameterized dialOptions string', async () => {
    const errors = await validate(createDto({ dialOptions: 'tTU(x)' }));
    expect(errors.filter((e) => e.property === 'dialOptions')).toHaveLength(0);
  });

  it('rejects a path-like greetingPrompt', async () => {
    const errors = await validate(createDto({ greetingPrompt: '../etc/passwd' }));
    expect(errors.some((e) => e.property === 'greetingPrompt')).toBe(true);
  });

  it('rejects a path-like mohClass', async () => {
    const errors = await validate(createDto({ mohClass: 'sales/../default' }));
    expect(errors.some((e) => e.property === 'mohClass')).toBe(true);
  });

  it('accepts identifier greetingPrompt and mohClass', async () => {
    const errors = await validate(createDto({ greetingPrompt: 'welcome', mohClass: 'moh_15_sales' }));
    expect(errors.filter((e) => e.property === 'greetingPrompt' || e.property === 'mohClass')).toHaveLength(0);
  });
});
