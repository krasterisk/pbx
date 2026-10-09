import { describe, it, expect } from 'vitest';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';
describe('Caller ID purpose and source help', () => {
  it('explains both fields and distinguishes manual input from original Caller ID', () => {
    expect(ru.routes.apps.calleridV2.numberTab).toBe('Номер');
    expect(en.routes.apps.calleridV2.numberTab).toBe('Number');
    expect(ru.routes.apps.calleridV2.snapshotHint).toContain('номер и имя');
    expect(en.routes.apps.calleridV2.snapshotHint).toContain('caller number and name');
    for (const locale of [ru, en]) {
      const cid = locale.routes.apps.calleridV2;
      expect(cid.numberSourceHint).not.toMatch(/Взять из списка номеров|Get from a number list/);
      for (const key of ['currentNumber', 'fixedNumber', 'directory', 'pool', 'variable'] as const)
        expect(cid.numberSourceHint).toContain(cid[key]);
      for (const key of ['currentName', 'fixedName', 'directory', 'variable'] as const)
        expect(cid.nameSourceHint).toContain(cid[key]);
      expect(cid.snapshotHint).not.toMatch(/[—–]/);
      expect(cid.numberSourceHint).not.toMatch(/[—–]/);
      expect(cid.nameSourceHint).not.toMatch(/[—–]/);
    }
  });
});
