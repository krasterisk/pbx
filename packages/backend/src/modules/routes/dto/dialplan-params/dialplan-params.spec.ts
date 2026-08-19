import {
  assertNeverAction,
  DIALPLAN_ACTION_META,
  type DialplanAction,
} from '@krasterisk/shared';
import { ActionTypesList } from '../route-action.dto';

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
