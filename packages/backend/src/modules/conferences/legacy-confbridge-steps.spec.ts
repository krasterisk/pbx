import * as fs from 'fs';
import * as path from 'path';
import { MODULE_COVERAGE } from '../ai-platform/module-coverage.registry';
import {
  classifyLegacyConfbridgeStep,
  stripLegacyConfbridgeKeys,
} from './legacy-confbridge-steps.util';

describe('legacy confbridge steps (16-03)', () => {
  const fixedWithOptions = {
    type: 'confbridge',
    params: { room: { source: 'fixed', value: '6007' }, options: 'x' },
  };

  it('flags a dead options key and a known tenant number', () => {
    const result = classifyLegacyConfbridgeStep(fixedWithOptions, new Set(['6007']));
    expect(result.applicable).toBe(true);
    expect(result.staticSource).toBe(true);
    expect(result.numberKnown).toBe(true);
    expect(result.hasDeadKey).toBe(true);
  });

  it('reports the number as unknown when the tenant has no rooms', () => {
    const result = classifyLegacyConfbridgeStep(fixedWithOptions, new Set());
    expect(result.numberKnown).toBe(false);
    expect(result.hasDeadKey).toBe(true);
  });

  it('does not claim a missing number for a dynamic room source', () => {
    const result = classifyLegacyConfbridgeStep(
      { type: 'confbridge', params: { room: { source: 'route_pattern' } } },
      new Set(),
    );
    expect(result.applicable).toBe(true);
    expect(result.staticSource).toBe(false);
    expect(result.numberKnown).not.toBe(false);
  });

  it('ignores steps of another type', () => {
    const result = classifyLegacyConfbridgeStep({ type: 'toqueue', params: {} }, new Set(['6007']));
    expect(result.applicable).toBe(false);
  });

  it('strips only the dead options key', () => {
    const result = stripLegacyConfbridgeKeys({
      room: { source: 'fixed', value: '1' },
      options: 'x',
    });
    expect(result.changed).toBe(true);
    expect(result.params).toEqual({ room: { source: 'fixed', value: '1' } });
    expect(result.params).not.toHaveProperty('options');
  });

  it('leaves params without options unchanged', () => {
    const params = { room: { source: 'fixed', value: '1' } };
    const result = stripLegacyConfbridgeKeys(params);
    expect(result.changed).toBe(false);
    expect(result.params).toEqual(params);
  });

  it('registers conferences as covered by the configuration adapter', () => {
    const entry = MODULE_COVERAGE.conferences;
    expect(entry).toBeDefined();
    expect(entry).toEqual({ kind: 'covered', capability: 'configure' });
  });

  it('registers db:report:legacy-confbridge next to the directories setup script', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:report:legacy-confbridge']).toMatch(
      /ts-node -r tsconfig-paths\/register src\/modules\/conferences\/report-legacy-confbridge-steps\.ts/,
    );
  });
});
