import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import { generatePolicyDialplan } from './directory-policy-dialplan.util';
import type { RouteDirectoryBinding } from './route-directory-binding.model';

describe('generatePolicyDialplan', () => {
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

  function binding(overrides: Record<string, unknown> = {}): RouteDirectoryBinding {
    return {
      uid: 3,
      directory_uid: 7,
      key_source: { source: 'original_caller' },
      match_mode: 'on_match',
      behavior_type: 'drop',
      behavior_params: {},
      actions: null,
      ...overrides,
    } as RouteDirectoryBinding;
  }

  function directory() {
    return { uid: 7, name: 'VIP' };
  }

  it('names the category dir_policy_{bindingUid}_{tenantUid}', () => {
    const result = generatePolicyDialplan(binding(), directory(), vpbx, 'sip-in42', false);
    expect(result.name).toBe('dir_policy_3_42');
    expect(result.lines[0]).toBe('[dir_policy_3_42]');
  });

  it('uses the centralized directory-lookup protocol and never emits PB_ or phonebook-lookup', () => {
    const result = generatePolicyDialplan(
      binding({
        behavior_type: 'map_fields',
        behavior_params: { mappings: [{ fieldUid: 17, targetVariable: 'CUSTOMER_NAME' }] },
      }),
      directory(),
      vpbx,
      'sip-in42',
      false,
    );
    const dp = result.lines.join('\n');
    expect(dp).toContain('/internal/dialplan/directory-lookup?');
    expect(dp).toContain('directory_uid=7');
    expect(dp).toContain('user_uid=42');
    expect(dp).toContain('key=${URIENCODE(${KRSK_ORIG_CALLER_NUM})}');
    expect(dp).toContain('KDL1');
    expect(dp).toContain('Set(CURLOPT(conntimeout)=1)');
    expect(dp).toContain('Set(CURLOPT(httptimeout)=2)');
    expect(dp).not.toContain('phonebook-lookup');
    expect(dp).not.toContain('PB_');
    expect((dp.match(/\$\{CURL\(/g) ?? []).length).toBe(1);
  });

  it('treats ERROR as fail-open: drop is not executed on the ERROR path', () => {
    const result = generatePolicyDialplan(
      binding({ match_mode: 'on_no_match', behavior_type: 'drop' }),
      directory(),
      vpbx,
      'sip-in42',
      false,
    );
    const dp = result.lines.join('\n');
    expect(dp).toContain('GotoIf($["${KRSK_DL_P3_STATUS}" = "ERROR"]?done)');
    expect(dp).toContain('same => n(done),Return()');
    expect(dp).toContain('Hangup()');
    expect(dp.indexOf('Hangup()')).toBeLessThan(dp.indexOf('n(done),Return()'));
    const doneBlock = dp.slice(dp.indexOf('n(done),Return()'));
    expect(doneBlock).not.toContain('Hangup()');
  });

  it('runs on_no_match drop only on literal NOT_FOUND, not ERROR', () => {
    const result = generatePolicyDialplan(
      binding({ match_mode: 'on_no_match', behavior_type: 'drop' }),
      directory(),
      vpbx,
      'sip-in42',
      false,
    );
    const dp = result.lines.join('\n');
    expect(dp).toContain('GotoIf($["${KRSK_DL_P3_STATUS}" = "NOT_FOUND"]?nomatch)');
    expect(dp).toContain('GotoIf($["${KRSK_DL_P3_STATUS}" = "ERROR"]?done)');
    const nomatchIdx = dp.indexOf('n(nomatch)');
    const hangupIdx = dp.indexOf('Hangup()');
    const doneIdx = dp.indexOf('n(done),Return()');
    expect(nomatchIdx).toBeGreaterThan(-1);
    expect(hangupIdx).toBeGreaterThan(nomatchIdx);
    expect(hangupIdx).toBeLessThan(doneIdx);
  });

  it('does not run on_no_match redirect on ERROR', () => {
    const result = generatePolicyDialplan(
      binding({
        match_mode: 'on_no_match',
        behavior_type: 'redirect',
        behavior_params: { fixedExten: '200' },
      }),
      directory(),
      vpbx,
      'sip-in42',
      false,
    );
    const dp = result.lines.join('\n');
    expect(dp).toContain('GotoIf($["${KRSK_DL_P3_STATUS}" = "ERROR"]?done)');
    expect(dp).toContain('Goto(sip-in42,200,1)');
    const doneBlock = dp.slice(dp.indexOf('n(done),Return()'));
    expect(doneBlock).not.toContain('Goto(');
  });

  it('map_fields writes only declared targets on FOUND', () => {
    const result = generatePolicyDialplan(
      binding({
        behavior_type: 'map_fields',
        behavior_params: { mappings: [{ fieldUid: 17, targetVariable: 'CUSTOMER_NAME' }] },
      }),
      directory(),
      vpbx,
      'sip-in42',
      false,
    );
    const dp = result.lines.join('\n');
    expect(dp).toContain('field_uids=17');
    expect(dp).toContain('Set(CUSTOMER_NAME=${KRSK_DL_P3_F17})');
    expect(dp).toContain('ExecIf($["${KRSK_DL_P3_STATUS}" = "FOUND"]?Set(CUSTOMER_NAME=${KRSK_DL_P3_F17}))');
    expect(dp).not.toContain('F18');
    expect(dp).not.toContain('Set(OTHER_');
  });

  it('on_match set_name from fieldUid writes CALLERID(name) only in the FOUND branch', () => {
    const result = generatePolicyDialplan(
      binding({
        behavior_type: 'set_name',
        behavior_params: { fieldUid: 17 },
      }),
      directory(),
      vpbx,
      'sip-in42',
      false,
    );
    const dp = result.lines.join('\n');
    expect(dp).toContain('GotoIf($["${KRSK_DL_P3_STATUS}" = "FOUND"]?found)');
    expect(dp).toContain('Set(CALLERID(name)=${KRSK_DL_P3_F17})');
    expect(dp.indexOf('n(found)')).toBeLessThan(dp.indexOf('Set(CALLERID(name)=${KRSK_DL_P3_F17})'));
    expect(dp.indexOf('Set(CALLERID(name)=${KRSK_DL_P3_F17})')).toBeLessThan(dp.indexOf('n(nomatch)'));
  });
});
