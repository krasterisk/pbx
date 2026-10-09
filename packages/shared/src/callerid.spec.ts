import {
  callerIdV2Errors,
  evaluateCallerIdName,
  evaluateCallerIdNumber,
  normalizeCallerIdParams,
} from './callerid';
describe('Caller ID v2', () => {
  it('accepts Unicode name edits with unset optional transform fields', () => {
    const rewrite={rules:[{id:'basic',transform:{prefix:'Отдел: ',postfix:undefined,stripStartCount:undefined,stripEndCount:undefined}}]};
    expect(callerIdV2Errors({version:2,name:{source:{source:'fixed',value:'Иван'},rewrite}})).toEqual([]);
    expect(evaluateCallerIdName('Иван',rewrite)).toMatchObject({output:'Отдел: Иван'});
    expect(callerIdV2Errors({version:2,number:{source:{source:'current'},rewrite}})).not.toEqual([]);
  });

  it('keeps both fields and rejects executable variable names and unknown fields', () => {
    expect(
      callerIdV2Errors({
        version: 2,
        number: { source: { source: 'fixed', value: '201' } },
        name: { source: { source: 'fixed', value: 'ООО "Тест", отдел' } },
      }),
    ).toEqual([]);
    expect(
      callerIdV2Errors({
        version: 2,
        number: { source: { source: 'variable', name: 'CALLERID(num)' } },
      }),
    ).not.toEqual([]);
    expect(
      callerIdV2Errors({
        version: 2,
        name: { source: { source: 'pool', numbers: ['201'], pick: 'random' } },
      }),
    ).not.toEqual([]);
    expect(
      callerIdV2Errors({ version: 2, number: { source: { source: 'current' }, extra: true } }),
    ).not.toEqual([]);
    expect(
      callerIdV2Errors({
        version: 2,
        number: {
          source: {
            source: 'directory',
            directoryUid: 1,
            valueFieldUid: 2,
            keySource: { source: 'current_caller' },
            onMissing: 'empty',
          },
        },
      }),
    ).not.toEqual([]);
  });
  it('rejects an oversized transformed number in the Caller ID preview', () => {
    expect(
      evaluateCallerIdNumber('2'.repeat(79), { rules: [{ id: 'x', transform: { prefix: '1' } }] })
        .error,
    ).toBe('charset');
  });
  it('normalizes legacy without touching the original object', () => {
    const raw = { mode: 'carousel', pool: ['201', '202'], name: 'Отдел' };
    expect(normalizeCallerIdParams(raw)).toMatchObject({
      version: 2,
      number: { source: { source: 'pool' } },
      name: { source: { source: 'fixed', value: 'Отдел' } },
    });
    expect(raw).not.toHaveProperty('version');
    expect(
      normalizeCallerIdParams({
        mode: 'directory',
        directoryUid: 1,
        valueFieldUid: 2,
        onMissing: 'empty',
      }),
    ).toMatchObject({ number: { source: { onMissing: 'keep' }, onMissing: 'empty' } });
    expect(normalizeCallerIdParams({ mode: 'static', callerid: '' })).toEqual({ version: 2 });
  });
  it('counts Unicode code points, replaces text and supports punctuation as data', () => {
    expect(
      evaluateCallerIdName('😀Отдел', {
        rules: [
          { id: 'x', conditions: [], transform: { stripStartCount: 1, prefix: 'ООО "Тест", ' } },
        ],
      }).output,
    ).toBe('ООО "Тест", Отдел');
    expect(
      evaluateCallerIdName('Отдел продаж', {
        rules: [
          {
            id: 'x',
            conditions: [{ kind: 'startsWith', value: 'Отдел' }],
            transform: { replaceFind: 'продаж', replaceWith: 'поддержки' },
          },
        ],
      }).output,
    ).toBe('Отдел поддержки');
  });
  it('uses first match, rejects telephone regex for names and can keep an empty name', () => {
    expect(evaluateCallerIdName('', undefined)).toEqual({ output: '', matchedRuleId: undefined });
    expect(evaluateCallerIdName('Имя', { rules: [], noMatch: 'reject' }).error).toBe('rejected');
    expect(
      evaluateCallerIdName('Имя', {
        rules: [
          { id: 'x', conditions: [{ kind: 'regex', value: '.*' }], transform: { prefix: 'X' } },
        ],
      }).error,
    ).toBe('invalid_transform');
  });
});
