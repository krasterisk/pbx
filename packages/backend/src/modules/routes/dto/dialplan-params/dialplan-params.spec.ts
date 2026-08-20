import {
  assertNeverAction,
  DIALPLAN_ACTION_META,
  type ActionType,
  type DialplanAction,
} from '@krasterisk/shared';
import { ActionTypesList } from '../route-action.dto';
import { ACTION_PARAM_DTO, resolveParamsDto } from './index';
import { MediaOptionsDto, serializeMediaOptions } from './media.params.dto';
import { validateActionParams } from '../../../../shared/pipes/action-params-validation.util';

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
    case 'setclid_custom':
      return action.params.callerid ?? '';
    case 'setclid_list':
      return String(action.params.list_uid ?? '');
    case 'notify':
      return action.params.message ?? '';
    case 'callerid':
      return action.params.mode;
    case 'trunk_carousel':
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
    case 'branch':
      return action.params.true_label ?? '';
    case 'schedule':
      return String(action.params.intervals?.length ?? '');
    case 'http_request':
      return action.params.url ?? '';
    case 'collect_input':
      return action.params.variableName ?? '';
    case 'busy':
      return String(action.params.timeout ?? '');
    case 'hangup':
      return action.params.causecode ?? '';
    case 'congestion':
      return String(action.params.timeout ?? '');
  }
  return assertNeverAction(action);
}

describe('D-08 DialplanAction union + D-24 meta + D-42 congestion', () => {
  it('has 28 ActionTypesList values including http_request and collect_input after 12-16', () => {
    expect(ActionTypesList).toHaveLength(28);
    expect(ActionTypesList).toContain('congestion');
    expect(ActionTypesList).toContain('voicemail');
    expect(ActionTypesList).not.toContain("tofax");
    expect(ActionTypesList).not.toContain("playprompt");
  });

  it('DIALPLAN_ACTION_META keys match ActionTypesList', () => {
    const metaKeys = Object.keys(DIALPLAN_ACTION_META).sort();
    const listKeys = [...ActionTypesList].sort();
    expect(metaKeys).toEqual(listKeys);
    expect(metaKeys).toHaveLength(28);
  });

  it('declares terminal flags required by D-24 / D-42', () => {
    expect(DIALPLAN_ACTION_META.toivr.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.toroute.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.hangup.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.busy.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.congestion.terminal).toBe('always');
    expect(DIALPLAN_ACTION_META.playback.terminal).toBe('conditional');
    expect(DIALPLAN_ACTION_META.setclid_custom.terminal).toBe('never');
  });

  it('exhaustiveness helper compiles and handles congestion', () => {
    const action: DialplanAction = {
      id: 'c1',
      condition: {},
      type: 'congestion',
      params: { timeout: 10 },
    };
    expect(describeAction(action)).toBe('10');
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
  setclid_custom: { callerid: '79001112233' },
  setclid_list: { list_uid: 2 },
  notify: { integration_uid: 1, message: 'hello' },
  callerid: { mode: 'static', callerid: '7900' },
  trunk_carousel: { mode: 'random_then_failover', trunks: [{ trunk: 'PJSIP/t1', cid_mode: 'static' }] },
  voicemail: { target: { source: 'route_pattern' } },
  text2speech: { text: 'hello', engine: 3 },
  voicerobot: { robot_uid: 5 },
  webhook: { url: 'https://example.com/hook' },
  confbridge: { room: { source: 'fixed', value: '100' } },
  cmd: { command: 'NoOp(ok)' },
  label: { label_name: 'retry' },
  goto: { label_name: 'retry' },
  branch: { true_label: 'ok', false_label: 'fail', condition: { source: 'dialstatus', values: ['ANSWER'] } },
  schedule: { intervals: [{ time_start: '09:00', time_end: '18:00', days_of_week: 'mon-fri', days_of_month: '*', months: '*' }] },
  http_request: { url: 'https://example.com/x', method: 'GET', timeout: 5 },
  collect_input: { variableName: 'PIN', digitsCount: 4, timeout: 5 },
  busy: {},
  hangup: {},
  congestion: {},
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
  setclid_custom: { callerid: 1 },
  setclid_list: { list_uid: false },
  notify: { integration_uid: 'x', message: '' },
  callerid: { mode: 'nope' },
  trunk_carousel: { mode: 'random_then_failover', trunks: 'x' },
  voicemail: { target: { source: 'fixed', value: '' } },
  text2speech: { engine: 'nope' },
  voicerobot: { robot_uid: 'x' },
  webhook: { url: 1 },
  confbridge: {},
  cmd: { command: 1 },
  label: { label_name: 1 },
  goto: { label_name: '' },
  branch: { true_label: '', false_label: '' },
  schedule: { intervals: [] },
  http_request: { url: 'http://localhost/', method: 'GET', timeout: 5 },
  collect_input: { variableName: 'a b', digitsCount: 0, timeout: 5 },
  busy: {},
  hangup: {},
  congestion: {},
};

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
});

describe('D-28 notify recipients', () => {
  it('rejects an invalid email recipient for the email channel', () => {
    const errors = validateActionParams([{
      id: 'n1',
      type: 'notify',
      params: { channels: ['email'], recipients: { email: 'not-an-email' }, body: 'hi' },
    }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid email recipient for the email channel', () => {
    const errors = validateActionParams([{
      id: 'n1',
      type: 'notify',
      params: { channels: ['email'], recipients: { email: 'ops@example.com' }, body: 'hi' },
    }]);
    expect(errors).toEqual([]);
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
  it('keeps setclid_custom name through the whitelist', () => {
    const errors = validateActionParams([{
      id: 'c1',
      type: 'setclid_custom',
      params: { callerid: '100', name: 'Sales' },
    }]);
    expect(errors).toEqual([]);
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

  it('accepts branch with both labels and a condition', () => {
    const errors = validateActionParams([{
      id: 'b1',
      type: 'branch',
      params: {
        true_label: 'ok',
        false_label: 'fail',
        condition: { source: 'dialstatus', values: ['ANSWER'] },
      },
    }]);
    expect(errors).toEqual([]);
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
