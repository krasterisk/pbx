import { compileCallerIdV2 } from './callerid-dialplan.util';
import { AsteriskDialplanUtils } from './dialplan.util';
import { validateActionParams } from '../pipes/action-params-validation.util';
import {
  callerIdListResponse,
  callerIdNameResponse,
} from '../../modules/dialplan-bridge/callerid-bridge.util';
import type { NumbersService } from '../../modules/numbers/numbers.service';
const ctx = {
  tenant: 7,
  scope: 'route:1',
  actionId: 'cid',
  backendBaseUrl: 'http://127.0.0.1:5010/api',
  apiKey: 'test',
};
describe('Caller ID v2 production contract', () => {
  it('captures snapshot and commits number only after computing name', () => {
    const dp = compileCallerIdV2(
      {
        version: 2,
        number: { source: { source: 'fixed', value: '201' } },
        name: { source: { source: 'fixed', value: 'ООО "Тест", имя' } },
      },
      ctx,
    );
    expect(dp).toContain('KRSK_CID2_IN_NUM=${CALLERID(num)}');
    expect(dp.indexOf('Set(CALLERID(num)=${KRSK_CID2_OUT_NUM})')).toBeGreaterThan(
      dp.indexOf('Set(KRSK_CID2_OUT_NAME=${BASE64_DECODE('),
    );
    expect(dp).not.toContain('ООО "Тест"');
    expect(dp).toContain('KRSK_ORIG_CALLER_CAPTURED');
  });
  it('uses locked owner-scoped pool state and separates different owners', () => {
    const params = {
      version: 2 as const,
      number: {
        source: { source: 'pool' as const, numbers: ['201', '202'], pick: 'round_robin' as const },
      },
    };
    const dp = compileCallerIdV2(params, ctx);
    expect(dp).toContain('${LOCK(');
    expect(dp).toContain('${UNLOCK(');
    expect(dp).toContain('SHA1');
    expect(dp).not.toEqual(compileCallerIdV2(params, { ...ctx, scope: 'route:2' }));
  });
  it('validates source and transformation before saving v2', () => {
    expect(
      validateActionParams([
        {
          id: 'cid',
          type: 'callerid',
          params: { version: 2, number: { source: { source: 'current' } } },
        },
      ]),
    ).toEqual([]);
    expect(
      validateActionParams([
        {
          id: 'cid',
          type: 'callerid',
          params: { version: 2, name: { source: { source: 'variable', name: 'KRSK_X' } } },
        },
      ]),
    ).not.toEqual([]);
    expect(
      validateActionParams([
        {
          id: 'cid',
          type: 'callerid',
          params: {
            version: 2,
            name: {
              source: { source: 'fixed', value: 'Имя' },
              rewrite: {
                rules: [{ id: 'r', conditions: [{ kind: 'regex', value: '.*' }], transform: {} }],
              },
            },
          },
        },
      ]),
    ).not.toEqual([]);
  });
  it('retains legacy generation until an explicit v2 save', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      { type: 'callerid', params: { mode: 'static', callerid: '201', name: 'Sales' } },
      7,
    );
    expect(dp).toContain('Set(CALLERID(num)=201)');
    expect(dp).not.toContain('KRSK_CID2');
  });
  it('computes UTF-8 name with the same evaluator and rejects malformed input', () => {
    const response = callerIdNameResponse({
      value: '😀Отдел',
      rewrite: Buffer.from(
        JSON.stringify({
          rules: [{ id: 'r', transform: { stripStartCount: 1, prefix: 'ООО "Тест", ' } }],
        }),
      ).toString('base64'),
    });
    expect(Buffer.from(response.split('|')[2], 'base64').toString('utf8')).toBe(
      'ООО "Тест", Отдел',
    );
    expect(callerIdNameResponse({ value: 'Имя', rewrite: 'bad' })).toBe('KCID2|ERROR|');
  });
  it('tenant-scopes lists, distinguishes mapping and first, materializes a safe pool', async () => {
    const findById = jest.fn().mockResolvedValue({
      numbers: [
        { from: '201', to: '7911' },
        { from: '202', to: '7922' },
      ],
    });
    const service = { findById } as unknown as NumbersService;
    const run = async (pick: string, key = '202') =>
      callerIdListResponse(service, { list_uid: '4', vpbx_user_uid: '7', pick, key });
    expect(Buffer.from((await run('mapping')).split('|')[2], 'base64').toString()).toBe('7922');
    expect(Buffer.from((await run('first')).split('|')[2], 'base64').toString()).toBe('7911');
    expect(Buffer.from((await run('round_robin')).split('|')[2], 'base64').toString()).toBe(
      '7911|7922',
    );
    expect(findById).toHaveBeenCalledWith(4, 7);
    findById.mockResolvedValue({numbers:['701','702']});
    expect(await run('mapping','201')).toBe('KCID2|NOT_FOUND|');
    expect(Buffer.from((await run('first','201')).split('|')[2],'base64').toString()).toBe('701');
    findById.mockResolvedValue({numbers:[]});
    expect(await run('round_robin')).toBe('KCID2|NOT_FOUND|');
    findById.mockResolvedValue(null);
    expect(await run('mapping')).toBe('KCID2|NOT_FOUND|');
    findById.mockRejectedValue(new Error('offline'));
    expect(await run('first')).toBe('KCID2|ERROR|');
  });
  it('aborts before either assignment on strict failures and explicitly clears fields', () => {
    const dp = compileCallerIdV2(
      {
        version: 2,
        number: {
          source: { source: 'variable', name: 'MY_CID' },
          onMissing: 'hangup',
          onError: 'hangup',
        },
        name: { source: { source: 'current' }, clear: true },
      },
      ctx,
    );
    expect(dp).toContain('Hangup(21)');
    expect(dp.indexOf('Hangup(21)')).toBeLessThan(dp.indexOf('Set(CALLERID(num)='));
    expect(dp).toContain('Set(KRSK_CID2_OUT_NAME=)');
  });

  it('never embeds an untrusted HTTP protocol field into an expression', () => {
    const dp = compileCallerIdV2(
      {
        version: 2,
        name: {
          source: { source: 'current' },
          rewrite: { rules: [{ id: 'r', transform: { prefix: 'X' } }] },
          onError: 'keep',
        },
      },
      ctx,
    );
    expect(dp).toContain('BASE64_ENCODE(${CUT(KRSK_CID2_NAME_RAW,|,1)})');
    expect(dp).not.toContain('"${CUT(KRSK_CID2_NAME_RAW,|,1)}" =');
    expect(dp).toContain('Set(KRSK_CID2_OUT_NAME=${KRSK_CID2_IN_NAME})');
  });
});
