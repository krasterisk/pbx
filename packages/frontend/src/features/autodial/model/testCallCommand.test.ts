import { describe, expect, it, beforeEach } from 'vitest';
import { readTestCallCommand, writeTestCallCommand } from './testCallCommand';

describe('unfinished test call request', () => {
  beforeEach(() => sessionStorage.clear());
  it('retains the exact payload after remount and isolates actor/campaign keys', () => {
    const command = { contact_uid: 4, expected_revision: 2, idempotency_key: 'same-request-123' };
    writeTestCallCommand('autodial:test:1:2:3', command);
    expect(readTestCallCommand('autodial:test:1:2:3')).toEqual(command);
    expect(readTestCallCommand('autodial:test:1:5:3')).toBeNull();
    writeTestCallCommand('autodial:test:1:2:3', null);
    expect(readTestCallCommand('autodial:test:1:2:3')).toBeNull();
  });
  it('rejects corrupt and invalid persisted inputs', () => {
    for (const input of ['{', '{}', '{"idempotency_key":"short"}', '{"idempotency_key":"valid-key-123","contact_uid":-1,"expected_revision":2}']) {
      sessionStorage.setItem('test', input); expect(readTestCallCommand('test')).toBeNull();
    }
  });
});
