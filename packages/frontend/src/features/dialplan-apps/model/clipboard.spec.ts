import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';
import type { IRouteAction } from '@krasterisk/shared';
import { copyStep, hasStep, pasteStep, peekStep, resetClipboard } from './clipboard';

const specDir = dirname(fileURLToPath(import.meta.url));

function step(id: string, params: Record<string, unknown> = {}): IRouteAction {
  return {
    id,
    type: 'toqueue',
    params,
    condition: {},
  };
}

describe('clipboard', () => {
  beforeEach(() => {
    resetClipboard();
  });

  it('starts empty', () => {
    expect(hasStep()).toBe(false);
    expect(peekStep()).toBeNull();
    expect(pasteStep(() => 'x')).toBeNull();
  });

  it('copyStep then pasteStep yields a deep params clone with a new id', () => {
    const source = step('src', { target: { source: 'fixed', value: 'sales' } });
    copyStep(source);

    expect(hasStep()).toBe(true);
    const pasted = pasteStep(() => 'pasted-id');
    expect(pasted).not.toBeNull();
    expect(pasted!.id).toBe('pasted-id');
    expect(pasted!.id).not.toBe(source.id);
    expect(pasted!.params).toEqual(source.params);
    expect(pasted!.params).not.toBe(source.params);
    expect((pasted!.params as { target: unknown }).target).not.toBe(source.params.target);
  });

  it('mutating a pasted step does not change peekStep params', () => {
    const source = step('src', { reason: 'busy' });
    copyStep(source);
    const pasted = pasteStep(() => 'clone');
    (pasted!.params as { reason: string }).reason = 'mutated';

    expect(peekStep()?.params).toEqual({ reason: 'busy' });
    expect(source.params).toEqual({ reason: 'busy' });
  });

  it('does not generate ids with Date.now or Math.random', () => {
    const src = readFileSync(join(specDir, 'clipboard.ts'), 'utf8');
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/Math\.random\s*\(/);
  });
});
