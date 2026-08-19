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
    case 'playprompt':
    case 'playback':
      return action.params.file ?? '';
    case 'setclid_custom':
      return action.params.callerid ?? '';
    case 'setclid_list':
      return String(action.params.list_uid ?? '');
    case 'sendmail':
      return action.params.email ?? '';
    case 'sendmailpeer':
      return action.params.exten ?? '';
    case 'telegram':
      return action.params.chat_id ?? '';
    case 'notify':
      return action.params.message;
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
    case 'asr':
    case 'keywords':
      return String(action.params.silence_timeout ?? '');
    case 'webhook':
      return action.params.url ?? '';
    case 'confbridge':
      return action.params.room?.source ?? '';
    case 'cmd':
      return action.params.command ?? '';
    case 'tofax':
      return action.params.email ?? '';
    case 'label':
      return action.params.label_name ?? '';
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
  it('has 30 ActionTypesList values including congestion', () => {
    expect(ActionTypesList).toHaveLength(30);
    expect(ActionTypesList).toContain('congestion');
  });

  it('DIALPLAN_ACTION_META keys match ActionTypesList', () => {
    const metaKeys = Object.keys(DIALPLAN_ACTION_META).sort();
    const listKeys = [...ActionTypesList].sort();
    expect(metaKeys).toEqual(listKeys);
    expect(metaKeys).toHaveLength(30);
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
  playprompt: { file: 'welcome', options: { noanswer: true }, langoverride: 'ru' },
  playback: { file: 'welcome', options: { noanswer: true, skip: false }, langoverride: 'ru' },
  setclid_custom: { callerid: '79001112233' },
  setclid_list: { list_uid: 2 },
  sendmail: { email: 'ops@example.com', text: 'hi' },
  sendmailpeer: { exten: '101', text: 'hi' },
  telegram: { chat_id: '1', text: 'hi' },
  notify: { integration_uid: 1, message: 'hello' },
  callerid: { mode: 'static', callerid: '7900' },
  trunk_carousel: { mode: 'random_then_failover', trunks: [{ trunk: 'PJSIP/t1', cid_mode: 'static' }] },
  voicemail: { target: { source: 'route_pattern' } },
  text2speech: { text: 'hello', engine: 3 },
  voicerobot: { robot_uid: 5 },
  asr: { silence_timeout: 3, max_timer: 6 },
  keywords: { silence_timeout: 3, max_timer: 6 },
  webhook: { url: 'https://example.com/hook' },
  confbridge: { room: { source: 'fixed', value: '100' } },
  cmd: { command: 'NoOp(ok)' },
  tofax: { email: 'fax@example.com' },
  label: { label_name: 'retry' },
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
  playprompt: { digittimeout: -1 },
  playback: { digittimeout: -1 },
  setclid_custom: { callerid: 1 },
  setclid_list: { list_uid: false },
  sendmail: { email: 1 },
  sendmailpeer: { exten: 1 },
  telegram: { chat_id: 1 },
  notify: { integration_uid: 'x', message: '' },
  callerid: { mode: 'nope' },
  trunk_carousel: { mode: 'random_then_failover', trunks: 'x' },
  voicemail: { target: { source: 'fixed', value: '' } },
  text2speech: { engine: 'nope' },
  voicerobot: { robot_uid: 'x' },
  asr: { silence_timeout: -1 },
  keywords: { max_timer: -1 },
  webhook: { url: 1 },
  confbridge: {},
  cmd: { command: 1 },
  tofax: { email: 1 },
  label: { label_name: 1 },
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
