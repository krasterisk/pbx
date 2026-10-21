import { afterEach, describe, expect, it, vi } from 'vitest';
import { autodialOperationId } from './operationId';

afterEach(() => vi.unstubAllGlobals());
describe('local HTTP operation identifiers', () => {
  it('generates valid distinct UUIDs when randomUUID requires a secure context', () => {
    const crypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const ids = Array.from({ length: 100 }, autodialOperationId);
    expect(new Set(ids).size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  });
});
