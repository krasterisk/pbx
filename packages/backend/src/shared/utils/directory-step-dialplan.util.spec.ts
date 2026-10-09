import '../../../../shared/src/directoryStep.spec';
import { renderActionChain, AsteriskDialplanUtils } from './dialplan.util';
import {
  validateActionParams,
  collectHostActionErrors,
} from '../pipes/action-params-validation.util';
import { ActionLog } from '../../modules/logger/action-log.model';
import { Context } from '../../modules/contexts/context.model';
import { validateLabelRefs } from './dialplan-labels.util';
import { walkDialplanGraph } from '@krasterisk/shared';
import { RoutesService } from '../../modules/routes/routes.service';
const step = (id = 'directory', patch: Record<string, unknown> = {}) => ({
  id,
  type: 'directory_lookup',
  params: {
    directoryUid: 7,
    keySource: { source: 'current_caller' },
    outputs: [],
    onMissing: 'keep',
    matchMode: 'on_match',
    behavior: 'set_name',
    behaviorParams: { fixed: 'Иван, \"VIP\"' },
    ...patch,
  },
  condition: {},
});
describe('Directory step execution', () => {
  it('does not execute disabled actions or resolve disabled labels, including in the abstract walk',()=>{
    expect(AsteriskDialplanUtils.actionToDialplan({id:'off',type:'hangup',params:{},enabled:false},42)).toBe('');
    expect(renderActionChain([{...step(),enabled:false}],{host:'route',vpbxUserUid:42})).toBe('');
    expect(validateLabelRefs([{id:'off',type:'label',enabled:false,params:{label_name:'end'}},{id:'jump',type:'goto',params:{label_name:'end'}}])[0].actionId).toBe('jump');
    const result=walkDialplanGraph({host:'route',actions:[{id:'off',type:'hangup',enabled:false,params:{}},{id:'on',type:'playback',params:{files:['beep']}}]});
    expect(result.segments.flatMap(segment=>segment.nodes).map(node=>node.actionId)).toEqual(['on']);
  });
  it('rejects a foreign redirect context and checks numeric string directory ownership',async()=>{
    const directories={count:jest.fn().mockResolvedValue(1)};
    const service=new RoutesService({} as never,{} as never,directories as never,{count:jest.fn().mockResolvedValue(1)} as never,{} as never);
    jest.spyOn(Context,'findAll').mockResolvedValue([]);
    await expect(service.validateCallerIdConfiguration([step('foreign',{directoryUid:'7',behavior:'redirect',behaviorParams:{targetContext:'foreign',fixedExten:'200'}})],42)).rejects.toThrow('another tenant');
    expect(directories.count).toHaveBeenCalledWith({where:{uid:[7],user_uid:42}});
    directories.count.mockResolvedValue(0);
    await expect(service.validateCallerIdConfiguration([step('foreign',{directoryUid:'8'})],42)).rejects.toThrow('another tenant');
  });
  beforeAll(() =>
    jest.spyOn(ActionLog, 'create').mockResolvedValue({} as never),
  );
  afterAll(() => jest.restoreAllMocks());
  it('keeps following applications in the caller chain and preserves the dialed extension', () => {
    const dp = renderActionChain(
      [
        {
          id: 'before',
          type: 'cmd',
          params: { command: 'NoOp(BEFORE)' },
          condition: {},
        },
        step(),
        {
          id: 'after',
          type: 'cmd',
          params: { command: 'NoOp(AFTER)' },
          condition: {},
        },
      ],
      {
        host: 'route',
        ownerId: 3,
        vpbxUserUid: 42,
        routeContext: 'sip42',
        isAdmin: true,
      },
    );
    const boundary = dp.indexOf('\n[');
    expect(dp.indexOf('NoOp(AFTER)')).toBeLessThan(boundary);
    expect(dp).toMatch(
      /Gosub\(dir_policy_S[a-f0-9]+_42,\$\{EXTEN\},1\(\$\{CONTEXT\}\)\)/,
    );
    expect(dp).toContain('exten => _.,1,');
    expect(dp).toContain(
      'BASE64_DECODE(' + Buffer.from('Иван, \"VIP\"').toString('base64') + ')',
    );
    expect(dp).toContain(
      'key=\$'.replace('\\', '') +
        '{URIENCODE(' +
        String.fromCharCode(36) +
        '{CALLERID(num)})}',
    );
    expect(dp).toContain('Return()');
  });
  it('gates not-found behavior separately from transport errors', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      step('d', { matchMode: 'on_no_match', behavior: 'drop' }),
      42,
    );
    expect(dp).toContain('"ERROR"]?_KRSK_DIR_done');
    expect(dp).toContain('"NOT_FOUND"]?_KRSK_DIR_nomatch');
    expect(dp.indexOf('Hangup()')).toBeGreaterThan(
      dp.indexOf('(_KRSK_DIR_nomatch)'),
    );
  });
  it('places custom child auxiliary contexts after the policy Return', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      step('d', {
        behavior: 'custom',
        behaviorParams: {},
        actions: [
          {
            id: 'vm',
            type: 'voicemail',
            params: { mailbox: '200' },
            condition: {},
          },
        ],
      }),
      42,
    );
    expect(dp.indexOf('(_KRSK_DIR_done),Return()')).toBeGreaterThan(0);
    expect(dp.indexOf('[krsk-vm-done-42]')).toBeGreaterThan(
      dp.indexOf('(_KRSK_DIR_done),Return()'),
    );
  });
  it('accepts numeric catalog strings and validates nested child params and label scope', () => {
    expect(validateActionParams([step('d', { directoryUid: '7' })])).toEqual(
      [],
    );
    const errors = collectHostActionErrors({
      actions: [
        step('d', {
          behavior: 'custom',
          actions: [
            { id: 'bad', type: 'notify', params: {}, condition: {} },
            {
              id: 'g',
              type: 'goto',
              params: { label_name: 'missing' },
              condition: {},
            },
          ],
        }),
      ],
    });
    expect(errors.some((e) => e.actionId === 'bad')).toBe(true);
    expect(errors.some((e) => e.actionId === 'g')).toBe(true);
  });
  it('emits one policy context for multiple route extensions at the requested chain position', async () => {
    const routeModel = { findAll: jest.fn() };
    const service = new RoutesService(
      routeModel as never,
      {} as never,
      {} as never,
      {} as never,
      { findAll: jest.fn().mockResolvedValue([]) } as never,
    );
    const route = {
      uid: 3,
      name: 'Test',
      active: 1,
      context_uid: 1,
      options: {},
      extensions: ['200', '201'],
      bindings: [],
      actions: [step()],
    } as never;
    routeModel.findAll.mockResolvedValue([route]);
    const dp = await service.generateContextDialplan(1, 42, 'sip', []);
    expect((dp.match(/^\[dir_policy_/gm) ?? []).length).toBe(1);
    expect((dp.match(/Gosub\(dir_policy_/g) ?? []).length).toBe(2);
    expect(dp).toContain('[sip42]');
  });
});
