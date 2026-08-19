import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import { generateBindingDialplan } from './phonebook-dialplan.util';
import type { RoutePhonebookBinding } from './route-phonebook-binding.model';
import type { RoutePhonebook } from './phonebook.model';

describe('generateBindingDialplan (Wave 0 characterization)', () => {
  const vpbx = 42;
  const prevKey = AsteriskDialplanUtils.dialplanApiKey;
  const prevUrl = AsteriskDialplanUtils.backendBaseUrl;

  beforeEach(() => {
    AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
    AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
  });

  afterEach(() => {
    AsteriskDialplanUtils.backendBaseUrl = prevUrl;
    AsteriskDialplanUtils.dialplanApiKey = prevKey;
  });

  function binding(overrides: Record<string, unknown> = {}): RoutePhonebookBinding {
    return {
      uid: 3,
      match_mode: 'on_match',
      behavior_type: 'custom',
      behavior_params: {},
      actions: [{ type: 'hangup', params: {}, condition: {} }],
      ...overrides,
    } as RoutePhonebookBinding;
  }

  function phonebook(): RoutePhonebook {
    return { uid: 7, name: 'VIP', entries: [] } as RoutePhonebook;
  }

  it('happy-path custom hangup emits exact binding category (toBe)', () => {
    const result = generateBindingDialplan(
      binding(),
      phonebook(),
      vpbx,
      'sip-in42',
      false,
    );
    expect(result.name).toBe('pb_bind_3_42');
    expect(result.lines.join('\n')).toBe(
      [
        '[pb_bind_3_42]',
        'exten => s,1,NoOp(PB binding 3: VIP / custom)',
        'same => n,Set(PB_RAW=${CURL(http://backend.test/api/internal/dialplan/phonebook-lookup?phonebook_uid=7&api_key=wave0-key&number=${URIENCODE(${CALLERID(num)})})})',
        'same => n,GotoIf($["${PB_RAW}" = ""]?nomatch)',
        'same => n,Set(PB_MATCH=${CUT(PB_RAW,|,1)})',
        'same => n,GotoIf($["${PB_MATCH}" = "1"]?act:nomatch)',
        'same => n(act),NoOp(PB VIP: acting)',
        'same => n,Hangup()',
        'same => n,Return()',
        'same => n(nomatch),Return()',
      ].join('\n'),
    );
  });

  /**
   * phonebook-dialplan.util.ts:143 — guard was missing; 12-05 renderActionChain adds WT_.
   */
  it('custom action with time_group_uid emits WT_ guard (guard appeared where it was absent)', () => {
    const result = generateBindingDialplan(
      binding({
        actions: [
          {
            type: 'hangup',
            params: {},
            condition: { time_group_uid: 12 },
          },
        ],
      }),
      phonebook(),
      vpbx,
      'sip-in42',
      false,
    );
    const dp = result.lines.join('\n');
    expect(dp).toMatch(/ExecIfTime|WT_/);
    expect(dp).toContain('ExecIf($["${WT_12}"="1"]?Hangup())');
  });

  it('drop behavior emits Hangup without custom actions', () => {
    const result = generateBindingDialplan(
      binding({ behavior_type: 'drop', actions: [] }),
      phonebook(),
      vpbx,
      'sip-in42',
      false,
    );
    expect(result.lines.join('\n')).toBe(
      [
        '[pb_bind_3_42]',
        'exten => s,1,NoOp(PB binding 3: VIP / drop)',
        'same => n,Set(PB_RAW=${CURL(http://backend.test/api/internal/dialplan/phonebook-lookup?phonebook_uid=7&api_key=wave0-key&number=${URIENCODE(${CALLERID(num)})})})',
        'same => n,GotoIf($["${PB_RAW}" = ""]?nomatch)',
        'same => n,Set(PB_MATCH=${CUT(PB_RAW,|,1)})',
        'same => n,GotoIf($["${PB_MATCH}" = "1"]?act:nomatch)',
        'same => n(act),NoOp(PB VIP: acting)',
        'same => n,Hangup()',
        'same => n,Return()',
        'same => n(nomatch),Return()',
      ].join('\n'),
    );
  });

  it('uses pb_bind_{uid}_{vpbx} category name', () => {
    const result = generateBindingDialplan(
      binding(),
      phonebook(),
      vpbx,
      'sip-in42',
      false,
    );
    expect(result.lines[0]).toBe('[pb_bind_3_42]');
  });
});
