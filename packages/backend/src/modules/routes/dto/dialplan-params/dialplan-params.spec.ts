import {
  assertNeverAction,
  DIALPLAN_ACTION_META,
  type ActionType,
  type DialplanAction,
  type DirectoryValueSource,
  type IDirectoryLookupParams,
  type ITrunkCarouselItem,
} from '@krasterisk/shared';
import { ActionTypesList } from '../route-action.dto';
import { ACTION_PARAM_DTO, resolveParamsDto } from './index';
import { RecordOptionsDto, VoicemailParamsDto } from './address.params.dto';
import { MediaOptionsDto, serializeMediaOptions } from './media.params.dto';
import { validateActionParams } from '../../../../shared/pipes/action-params-validation.util';
import { validateAction } from './directory-lookup.params.dto';

/**
 * Compile-time exhaustiveness: a switch over DialplanAction['type'] without
 * `default` that ends in assertNeverAction must type-check only when the union
 * is complete (D-08).
 */
function describeAction(action: DialplanAction): string {
  switch (action.type) {
    case 'totrunk':
      return action.params.trunk ?? '';
    case 'toexten':
      return action.params.target.source;
    case 'toqueue':
      return action.params.target?.source ?? '';
    case 'togroup':
      return action.params.target?.source ?? action.params.group ?? '';
    case 'tolist':
      return action.params.numbers ?? '';
    case 'toivr':
      return String(action.params.ivr_uid ?? '');
    case 'toroute':
      return action.params.context ?? '';
    case 'playback':
      return action.params.file ?? '';
    case 'notify':
      return action.params.body ?? '';
    case 'callerid':
      return action.params.mode;
    case 'voicemail':
      return action.params.target?.source ?? action.params.exten ?? '';
    case 'text2speech':
      return action.params.text ?? '';
    case 'voicerobot':
      return String(action.params.robot_uid ?? '');
    case 'webhook':
      return action.params.url ?? '';
    case 'confbridge':
      return action.params.room?.source ?? '';
    case 'cmd':
      return action.params.command ?? '';
    case 'label':
      return action.params.label_name ?? '';
    case 'goto':
      return action.params.label_name ?? '';
    case 'schedule':
      return String(action.params.intervals?.length ?? '');
    case 'http_request':
      return action.params.url ?? '';
    case 'collect_input':
      return action.params.variableName ?? '';
    case 'hangup':
      return action.params.signal ?? '';
    case 'directory_lookup':
      return String(action.params.directoryUid ?? '');
    case 'callback':
      return action.params.window_start ?? '';
  }
  return assertNeverAction(action);
}

describe('D-08 DialplanAction union + D-24 meta', () => {
  it('has 24 ActionTypesList values including callback', () => {
    expect(ActionTypesList).toHaveLength(24);
    expect(ActionTypesList).toContain('voicemail');
    expect(ActionTypesList).toContain('directory_lookup');
    expect(ActionTypesList).toContain('callback');
    expect(ActionTypesList).not.toContain('trunk_carousel');
    expect(ActionTypesList).not.toContain('tofax');
    expect(ActionTypesList).not.toContain('playprompt');
  });

  it.each(['busy', 'congestion', 'branch', 'setclid_custom', 'setclid_list', 'trunk_carousel'])(
    'no longer offers the merged-away type %s',
    (type) => {
      expect(ActionTypesList).not.toContain(type);
      expect(Object.keys(DIALPLAN_ACTION_META)).not.toContain(type);
    },
  );

  it('DIALPLAN_ACTION_META keys match ActionTypesList', () => {
    const metaKeys = Object.keys(DIALPLAN_ACTION_META).sort();
    const listKeys = [...ActionTypesList].sort();
    expect(metaKeys).toEqual(listKeys);
    expect(metaKeys).toHaveLength(24);
  });

  it('registers directory_lookup metadata for route, directory_policy, and ivr', () => {
    expect(DIALPLAN_ACTION_META.directory_lookup).toEqual({
      terminal: 'never',
      allowedIn: ['route', 'directory_policy', 'ivr'],
      family: 'integration',
    });
  });

  it('accepts DirectoryValueSource and directory lookup fixtures', () => {
    const directorySource: DirectoryValueSource = {
      source: 'directory',
      directoryUid: 7,
      keySource: { source: 'original_caller' },
      valueFieldUid: 17,
      onMissing: 'skip',
    };
    const lookupParams: IDirectoryLookupParams = {
      directoryUid: 7,
      keySource: { source: 'original_caller' },
      outputs: [{ fieldUid: 17, targetVariable: 'CRM_NAME' }],
      onMissing: 'keep',
    };
    const carouselItem: ITrunkCarouselItem = {
      trunkId: 't_beta_100',
      callerId: {
        mode: 'directory',
        directoryUid: 7,
        valueFieldUid: 18,
        keySource: { source: 'original_caller' },
        onMissing: 'keep_original',
      },
      timeout: 45,
    };
    expect(directorySource.source).toBe('directory');
    expect(lookupParams.outputs).toHaveLength(1);
    expect(carouselItem.trunkId).toBe('t_beta_100');
  });

  it('declares terminal flags required by D-24 / D-42', () => {
    expect(DIALPLAN_ACTION_META.toivr.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.toroute.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.hangup.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.playback.terminal).toBe('conditional');
    expect(DIALPLAN_ACTION_META.callerid.terminal).toBe('never');
  });

  it('marks the unified goto as conditional so a fall-through tail stays reachable', () => {
    expect(DIALPLAN_ACTION_META.goto.terminal).toBe('conditional');
  });

  it('exhaustiveness helper compiles and handles the unified hangup', () => {
    const action: DialplanAction = {
      id: 'c1',
      condition: {},
      type: 'hangup',
      params: { signal: 'congestion', timeout: 10 },
    };
    expect(describeAction(action)).toBe('congestion');
  });
});

const VALID_PARAMS: Record<ActionType, Record<string, unknown>> = {
  totrunk: { trunk: 'PJSIP/t1', dest: { source: 'fixed', value: '7900' } },
  toexten: { target: { source: 'fixed', value: '101' }, webrtc: true },
  toqueue: { target: { source: 'route_pattern' } },
  togroup: { target: { source: 'fixed', value: 'sales' } },
  tolist: { numbers: '101,102' },
  toivr: { ivr_uid: 3 },
  toroute: { context: 'sip-in', extension: { source: 'route_pattern' } },
  playback: { file: 'welcome', options: { noanswer: true, skip: false }, langoverride: 'ru' },
  notify: { integration_uid: 1, body: 'hello' },
  callerid: { mode: 'static', callerid: '7900' },
  voicemail: {
    target: { source: 'route_pattern' },
    greeting: 'vm-greeting',
    max_duration: 120,
    silence_timeout: 5,
    record_options: { o: true, q: false },
    notify: { integration_uid: 4, body: 'new voicemail', target: 'ops@example.com', subject: 'VM' },
    stt_engine_uid: 2,
    llm_provider_uid: 3,
  },
  text2speech: { text: 'hello', engine: 3, settings: { voice: 'alena', speed: '1.0' } },
  voicerobot: { robot_uid: 5 },
  webhook: { url: 'https://example.com/hook' },
  confbridge: { room: { source: 'fixed', value: '100' } },
  cmd: { command: 'NoOp(ok)' },
  label: { label_name: 'retry' },
  goto: {
    label_name: 'ok',
    false_label: 'fail',
    condition: { source: 'dialstatus', values: ['ANSWER'] },
  },
  schedule: { intervals: [{ time_start: '09:00', time_end: '18:00', days_of_week: 'mon-fri', days_of_month: '*', months: '*' }] },
  http_request: { url: 'https://example.com/x', method: 'GET', timeout: 5 },
  collect_input: { variableName: 'PIN', digitsCount: 4, timeout: 5 },
  hangup: { signal: 'busy', timeout: 10 },
  directory_lookup: {
    directoryUid: 7,
    keySource: { source: 'original_caller' },
    outputs: [{ fieldUid: 17, targetVariable: 'CUSTOMER_NAME' }],
    onMissing: 'keep',
  },
  callback: {
    window_start: '09:00',
    window_end: '21:00',
    max_attempts: 3,
    pause_minutes: 30,
  },
};

const INVALID_PARAMS: Record<ActionType, Record<string, unknown>> = {
  totrunk: { dest: { source: 'fixed', value: '' } },
  toexten: { target: { source: 'fixed', value: '' } },
  toqueue: { target: { source: 'fixed', value: '' } },
  togroup: { target: { source: 'fixed', value: '' } },
  tolist: { timeout: -1 },
  toivr: { ivr_uid: 'x' },
  toroute: { extension: { source: 'fixed', value: '' } },
  playback: { digittimeout: -1 },
  notify: { integration_uid: 'x', body: '' },
  callerid: { mode: 'nope' },
  voicemail: { max_duration: 0 },
  text2speech: { engine: 'nope' },
  voicerobot: { robot_uid: 'x' },
  webhook: { url: 1 },
  confbridge: {},
  cmd: { command: 1 },
  label: { label_name: 1 },
  goto: { label_name: '' },
  schedule: { intervals: [] },
  http_request: { url: 'http://localhost/', method: 'GET', timeout: 5 },
  collect_input: { variableName: 'a b', digitsCount: 0, timeout: 5 },
  hangup: { signal: 'nope' },
  directory_lookup: { targetVariable: 'bad-name' },
  callback: { max_attempts: 0 },
};

describe('directory_lookup action DTO', () => {
  it('validates target variable names', () => {
    expect(validateAction({ targetVariable: 'CUSTOMER_NAME' })).toHaveLength(0);
    expect(validateAction({ targetVariable: 'CALLERID' })).not.toHaveLength(0);
    expect(validateAction({ targetVariable: 'bad-name' })).not.toHaveLength(0);
  });

  it('rejects phonebook leftover fields on a directory ValueSource', () => {
    const errors = validateActionParams([{
      id: 't1',
      type: 'totrunk',
      params: {
        trunk: 'PJSIP/t1',
        dest: { source: 'phonebook', phonebookUid: 3, varKey: 'bnum' },
      },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a directory dest ValueSource', () => {
    const errors = validateActionParams([{
      id: 't1',
      type: 'totrunk',
      params: {
        trunk: 'PJSIP/t1',
        dest: {
          source: 'directory',
          directoryUid: 7,
          keySource: { source: 'original_caller' },
          valueFieldUid: 17,
          onMissing: 'skip',
        },
      },
    }]);
    expect(errors).toEqual([]);
  });
});

describe('D-09 ACTION_PARAM_DTO registry', () => {
  it.each([...ActionTypesList] as ActionType[])('has an ACTION_PARAM_DTO entry for %s', (type) => {
    expect(Object.prototype.hasOwnProperty.call(ACTION_PARAM_DTO, type)).toBe(true);
    expect(resolveParamsDto(type) === null || typeof resolveParamsDto(type) === 'function').toBe(true);
  });

  it.each([...ActionTypesList] as ActionType[])('accepts a valid params object for %s', (type) => {
    const errors = validateActionParams([{ id: 'a1', type, params: VALID_PARAMS[type] }]);
    expect(errors).toEqual([]);
  });

  it.each([...ActionTypesList] as ActionType[])('rejects an invalid params object for %s', (type) => {
    if (resolveParamsDto(type) === null) {
      const errors = validateActionParams([{ id: 'a1', type, params: 'not-an-object' }]);
      expect(errors.length).toBeGreaterThan(0);
      return;
    }
    const errors = validateActionParams([{ id: 'a1', type, params: INVALID_PARAMS[type] }]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('D-38 MediaOptionsDto round-trip', () => {
  it.each(['nsp', 'nU(x)L(1:2:3)'])('serializes %s back to the original string', (raw) => {
    const parsed = MediaOptionsDto.fromString(raw);
    expect(serializeMediaOptions(parsed)).toBe(raw);
  });

  it('accepts a structured options object for playback', () => {
    const errors = validateActionParams([{
      id: 'p1',
      type: 'playback',
      params: { options: { noanswer: true, skip: false }, langoverride: 'ru' },
    }]);
    expect(errors).toEqual([]);
  });

  it('accepts a string options value and normalizes it', () => {
    const errors = validateActionParams([{
      id: 'p1',
      type: 'playback',
      params: { options: 'nsp' },
    }]);
    expect(errors).toEqual([]);
  });

  it('rejects DTMF-control option p when mode is plain', () => {
    const errors = validateActionParams([{
      id: 'p1',
      type: 'playback',
      params: { mode: 'plain', files: 'welcome', options: { p: true } },
    }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /p|control|режим|mode/i.test(`${e.path} ${e.message}`))).toBe(true);
  });

  it('accepts DTMF-control option p when mode is control', () => {
    const errors = validateActionParams([{
      id: 'p1',
      type: 'playback',
      params: { mode: 'control', files: 'welcome', options: { p: true } },
    }]);
    expect(errors).toEqual([]);
  });

  it('rejects langoverride when mode is not menu', () => {
    const errors = validateActionParams([{
      id: 'p1',
      type: 'playback',
      params: { mode: 'plain', files: 'welcome', langoverride: 'ru' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a path-like files value', () => {
    const errors = validateActionParams([{
      id: 'p1',
      type: 'playback',
      params: { mode: 'plain', files: '../etc/passwd' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an oversized digittimeout', () => {
    const errors = validateActionParams([{
      id: 'p1',
      type: 'playback',
      params: { mode: 'menu', files: 'menu', digittimeout: 99999 },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('D-39 / D-41 validateActionParams paths', () => {
  it('rejects empty toexten target.value with a dotted path', () => {
    const errors = validateActionParams([{
      id: 'e1',
      type: 'toexten',
      params: { target: { source: 'fixed', value: '' } },
    }]);
    expect(errors.some((e) => e.path === 'target.value')).toBe(true);
  });

  it('accepts toexten with webrtc true', () => {
    const errors = validateActionParams([{
      id: 'e1',
      type: 'toexten',
      params: { target: { source: 'fixed', value: '101' }, webrtc: true },
    }]);
    expect(errors).toEqual([]);
  });

  it('rejects confbridge without a room', () => {
    const errors = validateActionParams([{ id: 'c1', type: 'confbridge', params: {} }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path === 'room' || e.path.startsWith('room'))).toBe(true);
  });
});

describe('D-26 numberManipulation DTO', () => {
  it.each(['totrunk', 'dial', 'toexten'] as const)('accepts numberManipulation on %s', (type) => {
    const typeForDto = type === 'dial' ? 'toexten' : type;
    const params = typeForDto === 'toexten'
      ? { target: { source: 'fixed', value: '101' }, numberManipulation: { strip: 1, prepend: '8' } }
      : { trunk: 'PJSIP/t1', dest: { source: 'fixed', value: '7900' }, numberManipulation: { strip: 1, prepend: '8' } };
    const errors = validateActionParams([{ id: 'n1', type: typeForDto, params }]);
    expect(errors).toEqual([]);
  });

  it('rejects letter prepend with path numberManipulation.prepend', () => {
    const errors = validateActionParams([{
      id: 'n1',
      type: 'totrunk',
      params: { trunk: 'PJSIP/t1', dest: { source: 'fixed', value: '7900' }, numberManipulation: { prepend: 'abc' } },
    }]);
    expect(errors.some((e) => e.path === 'numberManipulation.prepend')).toBe(true);
  });

  it('accepts dest ${EXTEN} string as route_pattern', () => {
    const errors = validateActionParams([{
      id: 'n1',
      type: 'totrunk',
      params: { trunk: 'PJSIP/t1', dest: '${EXTEN}' },
    }]);
    expect(errors).toEqual([]);
  });

  it('accepts rewrite rules and rejects a bad regex kind value', () => {
    const ok = validateActionParams([{
      id: 'n1',
      type: 'totrunk',
      params: {
        trunk: 'PJSIP/t1',
        dest: { source: 'route_pattern' },
        rewrite: {
          noMatch: 'passthrough',
          rules: [{
            id: 'r1',
            transform: { prefix: '8' },
            conditions: [{ kind: 'startsWith', value: '7' }],
          }],
        },
      },
    }]);
    expect(ok).toEqual([]);

    const bad = validateActionParams([{
      id: 'n1',
      type: 'totrunk',
      params: {
        trunk: 'PJSIP/t1',
        dest: { source: 'route_pattern' },
        rewrite: { rules: [{ id: 'r1', transform: {}, conditions: [{ kind: 'nope' }] }] },
      },
    }]);
    expect(bad.length).toBeGreaterThan(0);
  });

  it('accepts single mode totrunk with cid_mode static and callerid', () => {
    const ok = validateActionParams([{
      id: 't1',
      type: 'totrunk',
      params: {
        trunkMode: 'single',
        trunk: 'PJSIP/t1',
        cid_mode: 'static',
        callerid: '79001234567',
        dest: { source: 'route_pattern' },
      },
    }]);
    expect(ok).toEqual([]);
  });

  it('accepts single mode totrunk with directory callerId', () => {
    const ok = validateActionParams([{
      id: 't2',
      type: 'totrunk',
      params: {
        trunkMode: 'single',
        trunk: 'PJSIP/t1',
        callerId: {
          mode: 'directory',
          directoryUid: 12,
          valueFieldUid: 17,
          keySource: { source: 'original_caller' },
          onMissing: 'keep_original',
        },
        dest: { source: 'route_pattern' },
      },
    }]);
    expect(ok).toEqual([]);
  });

  it('accepts carousel ITrunkCarouselItem with trunkId and directory callerId', () => {
    const ok = validateActionParams([{
      id: 't3',
      type: 'totrunk',
      params: {
        trunkMode: 'carousel',
        mode: 'sequential',
        trunks: [
          {
            trunkId: 't_alpha_100',
            timeout: 20,
            callerId: {
              mode: 'directory',
              directoryUid: 7,
              valueFieldUid: 17,
              keySource: { source: 'original_caller' },
              onMissing: 'keep_original',
            },
          },
          {
            trunkId: 't_beta_100',
            timeout: 30,
            callerId: { mode: 'static', value: '79001112233' },
          },
        ],
        dest: { source: 'route_pattern' },
      },
    }]);
    expect(ok).toEqual([]);
  });

  it('rejects leftover trunk/cid_mode/phonebook_uid carousel items', () => {
    const errors = validateActionParams([{
      id: 't4',
      type: 'totrunk',
      params: {
        trunkMode: 'carousel',
        trunks: [
          { trunk: 'PJSIP/t1', cid_mode: 'phonebook', phonebook_uid: 12 },
        ],
        dest: { source: 'route_pattern' },
      },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('notify routes through an integration', () => {
  it('requires an integration because the channel is owned by it', () => {
    const errors = validateActionParams([{
      id: 'n1',
      type: 'notify',
      params: { body: 'hi', target: 'ops@example.com' },
    }]);
    expect(errors.some((e) => e.path === 'integration_uid')).toBe(true);
  });

  it('accepts an integration, a body and a recipient override', () => {
    const errors = validateActionParams([{
      id: 'n1',
      type: 'notify',
      params: { integration_uid: 4, body: 'hi', target: 'ops@example.com' },
    }]);
    expect(errors).toEqual([]);
  });

  it('strips the removed per-channel fields instead of storing them', () => {
    const errors = validateActionParams([{
      id: 'n1',
      type: 'notify',
      params: {
        integration_uid: 4,
        body: 'hi',
        channels: ['email'],
        recipients: { email: 'ops@example.com' },
      },
    }]);
    expect(errors).toEqual([]);
  });
});

describe('voicemail D-56 / D-74 DTO', () => {
  it('accepts max_duration 120 with record_options.o', () => {
    const errors = validateActionParams([{
      id: 'v1',
      type: 'voicemail',
      params: { max_duration: 120, record_options: { o: true } },
    }]);
    expect(errors).toEqual([]);
  });

  it('rejects max_duration below 1 or non-numeric', () => {
    const below = validateActionParams([{
      id: 'v1',
      type: 'voicemail',
      params: { max_duration: 0 },
    }]);
    const nonNumeric = validateActionParams([{
      id: 'v1',
      type: 'voicemail',
      params: { max_duration: 'nope' },
    }]);
    expect(below.length).toBeGreaterThan(0);
    expect(below.some((e) => e.path === 'max_duration')).toBe(true);
    expect(nonNumeric.length).toBeGreaterThan(0);
    expect(nonNumeric.some((e) => e.path === 'max_duration')).toBe(true);
  });

  it('validates nested notify via NotifyParamsDto', () => {
    const ok = validateActionParams([{
      id: 'v1',
      type: 'voicemail',
      params: {
        notify: { integration_uid: 4, body: 'hi', target: 'ops@example.com', subject: 'VM' },
      },
    }]);
    const missingUid = validateActionParams([{
      id: 'v1',
      type: 'voicemail',
      params: { notify: { body: 'hi' } },
    }]);
    expect(ok).toEqual([]);
    expect(missingUid.some((e) => e.path === 'notify.integration_uid')).toBe(true);
  });

  it('ignores record_options.k and does not declare k on RecordOptionsDto', () => {
    const errors = validateActionParams([{
      id: 'v1',
      type: 'voicemail',
      params: { record_options: { o: true, k: true } },
    }]);
    expect(errors).toEqual([]);
    expect(errors.some((e) => e.path.includes('.k') || e.path.endsWith('k'))).toBe(false);
    expect(new RecordOptionsDto()).not.toHaveProperty('k');
    const dto = new VoicemailParamsDto();
    dto.max_duration = 120;
    dto.record_options = { o: true };
    dto.notify = { integration_uid: 4, body: 'hi' };
    expect(dto.max_duration).toBe(120);
    expect(dto.record_options).toEqual({ o: true });
    expect(dto.notify).toEqual({ integration_uid: 4, body: 'hi' });
  });

  it('rejects a path-like greeting', () => {
    const errors = validateActionParams([{
      id: 'v1',
      type: 'voicemail',
      params: { greeting: '../etc/passwd' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path === 'greeting')).toBe(true);
  });
});

describe('D-30 text2speech engine', () => {
  it('rejects an engine that is not a catalog uid', () => {
    const errors = validateActionParams([{
      id: 't1',
      type: 'text2speech',
      params: { text: 'hello', engine: 'nope' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path === 'engine' || e.message.toLowerCase().includes('engine'))).toBe(true);
  });
});

describe('D-32 / D-39 / D-43 params whitelist', () => {
  it('keeps the static callerid name through the whitelist', () => {
    const errors = validateActionParams([{
      id: 'c1',
      type: 'callerid',
      params: { mode: 'static', callerid: '100', name: 'Sales' },
    }]);
    expect(errors).toEqual([]);
  });

  it('accepts standalone callerid mode=directory with lookup fields', () => {
    const errors = validateActionParams([{
      id: 'c2',
      type: 'callerid',
      params: {
        mode: 'directory',
        directoryUid: 7,
        valueFieldUid: 18,
        keySource: { source: 'original_caller' },
        onMissing: 'keep',
      },
    }]);
    expect(errors).toEqual([]);
  });

  it('rejects leftover phonebook mode on standalone callerid', () => {
    const errors = validateActionParams([{
      id: 'c3',
      type: 'callerid',
      params: { mode: 'phonebook', phonebook_uid: 7 },
    }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path === 'mode' || e.path === 'phonebook_uid')).toBe(true);
  });

  it('rejects leftover phonebook_uid on directory callerid', () => {
    const errors = validateActionParams([{
      id: 'c4',
      type: 'callerid',
      params: {
        mode: 'directory',
        directoryUid: 7,
        valueFieldUid: 18,
        keySource: { source: 'original_caller' },
        onMissing: 'keep',
        phonebook_uid: 7,
      },
    }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path === 'phonebook_uid')).toBe(true);
  });

  it('rejects directory callerid missing lookup fields', () => {
    const errors = validateActionParams([{
      id: 'c5',
      type: 'callerid',
      params: { mode: 'directory' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path === 'directoryUid')).toBe(true);
    expect(errors.some((e) => e.path === 'valueFieldUid')).toBe(true);
  });

  it('rejects empty toexten target (D-39)', () => {
    const errors = validateActionParams([{
      id: 'e1',
      type: 'toexten',
      params: { target: { source: 'fixed', value: '' } },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects announceoverride with path traversal', () => {
    const errors = validateActionParams([{
      id: 'q1',
      type: 'toqueue',
      params: { target: { source: 'fixed', value: 'sales' }, announceoverride: '../etc/passwd' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts toqueue priority and a safe announceoverride', () => {
    const errors = validateActionParams([{
      id: 'q1',
      type: 'toqueue',
      params: { target: { source: 'fixed', value: 'sales' }, priority: 5, announceoverride: 'vip-welcome' },
    }]);
    expect(errors).toEqual([]);
  });

  it('accepts toqueue priority as ValueSource variable', () => {
    const errors = validateActionParams([{
      id: 'q1',
      type: 'toqueue',
      params: {
        target: { source: 'fixed', value: 'sales' },
        priority: { source: 'variable', name: 'VIP_PRIO' },
      },
    }]);
    expect(errors).toEqual([]);
  });

  it('rejects an out-of-range QUEUE_PRIO', () => {
    const errors = validateActionParams([{
      id: 'q1',
      type: 'toqueue',
      params: { target: { source: 'fixed', value: 'sales' }, priority: 999 },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('D-44 / D-45 new control params', () => {
  it('rejects schedule with an empty intervals array', () => {
    const errors = validateActionParams([{
      id: 's1',
      type: 'schedule',
      params: { intervals: [] },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts schedule with a time_group-shaped interval', () => {
    const errors = validateActionParams([{
      id: 's1',
      type: 'schedule',
      params: {
        intervals: [{
          time_start: '09:00',
          time_end: '18:00',
          days_of_week: 'mon-fri',
          days_of_month: '*',
          months: '*',
        }],
      },
    }]);
    expect(errors).toEqual([]);
  });

  it('accepts goto with a label name', () => {
    const errors = validateActionParams([{
      id: 'g1',
      type: 'goto',
      params: { label_name: 'start' },
    }]);
    expect(errors).toEqual([]);
  });

  it('accepts goto with a condition and an else-label', () => {
    const errors = validateActionParams([{
      id: 'g1',
      type: 'goto',
      params: {
        label_name: 'ok',
        false_label: 'fail',
        condition: { source: 'dialstatus', values: ['ANSWER'] },
      },
    }]);
    expect(errors).toEqual([]);
  });

  it.each(['busy', 'congestion', 'hangup'])('accepts hangup with signal %s', (signal) => {
    const errors = validateActionParams([{
      id: 'h1',
      type: 'hangup',
      params: { signal },
    }]);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown hangup signal', () => {
    const errors = validateActionParams([{
      id: 'h1',
      type: 'hangup',
      params: { signal: 'nope' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('D-47 / D-49 http_request and collect_input DTO', () => {
  const ssrf = [
    'https://example.com/x',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://127.0.0.1/',
    'http://localhost/',
    'http://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
    'gopher://x/',
  ] as const;

  it.each(ssrf)('DTO http_request url %s', (url) => {
    const errors = validateActionParams([{
      id: 'h1',
      type: 'http_request',
      params: { url, method: 'GET', timeout: 5 },
    }]);
    if (url === 'https://example.com/x') {
      expect(errors).toEqual([]);
    } else {
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects missing or zero timeout', () => {
    const missing = validateActionParams([{
      id: 'h1',
      type: 'http_request',
      params: { url: 'https://example.com/x', method: 'GET' },
    }]);
    const zero = validateActionParams([{
      id: 'h1',
      type: 'http_request',
      params: { url: 'https://example.com/x', method: 'GET', timeout: 0 },
    }]);
    expect(missing.length).toBeGreaterThan(0);
    expect(zero.length).toBeGreaterThan(0);
  });

  it('rejects collect_input digitsCount 0 and a spaced variable name', () => {
    const zeroDigits = validateActionParams([{
      id: 'c1',
      type: 'collect_input',
      params: { variableName: 'PIN', digitsCount: 0, timeout: 5 },
    }]);
    const badName = validateActionParams([{
      id: 'c1',
      type: 'collect_input',
      params: { variableName: 'a b', digitsCount: 4, timeout: 5 },
    }]);
    expect(zeroDigits.length).toBeGreaterThan(0);
    expect(badName.length).toBeGreaterThan(0);
  });
});
