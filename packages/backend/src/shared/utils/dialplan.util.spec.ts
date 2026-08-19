import * as fs from 'fs';
import * as path from 'path';
import type { ActionType } from '@krasterisk/shared';
import { AsteriskDialplanUtils } from './dialplan.util';

/** Runtime copy of the shared ActionType union — compile-fails if a member is missing. */
const ACTION_TYPES = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playprompt', 'playback',
  'setclid_custom', 'setclid_list',
  'sendmail', 'sendmailpeer', 'telegram',
  'notify', 'callerid', 'trunk_carousel',
  'voicemail', 'text2speech', 'voicerobot', 'asr', 'keywords',
  'webhook', 'confbridge', 'cmd', 'tofax',
  'label', 'busy', 'hangup', 'congestion',
] as const satisfies readonly ActionType[];

type MissingActionType = Exclude<ActionType, (typeof ACTION_TYPES)[number]>;
const _assertActionTypesComplete: [MissingActionType] extends [never] ? true : MissingActionType = true;
void _assertActionTypesComplete;

/**
 * Manifest of types that have an exact toBe characterization (Wave 0 + pre-existing).
 * Test 3 diffs this set against ACTION_TYPES so a new type cannot land silently.
 */
const CHARACTERIZED_TYPES: readonly ActionType[] = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playprompt', 'playback',
  'setclid_custom', 'setclid_list',
  'sendmail', 'sendmailpeer', 'telegram',
  'notify', 'callerid', 'trunk_carousel',
  'voicemail', 'text2speech', 'voicerobot', 'asr', 'keywords',
  'webhook', 'confbridge', 'cmd', 'tofax',
  'label', 'busy', 'hangup', 'congestion',
];

describe('AsteriskDialplanUtils.actionToDialplan', () => {
  const vpbx = 42;

  describe('DIALSTATUS condition wrapper', () => {
    it('wraps a single valid dialstatus in ExecIf', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'busy', params: {}, condition: { dialstatus: 'ANSWER' } },
        vpbx,
      );
      expect(dp).toBe('ExecIf($["${DIALSTATUS}" = "ANSWER"]?Busy(10))');
    });

    it('OR-joins an array of dialstatuses into a single ExecIf', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'busy',
          params: {},
          condition: { dialstatus: ['ANSWER', 'NOANSWER'] },
        },
        vpbx,
      );
      expect(dp).toBe(
        'ExecIf($["${DIALSTATUS}" = "ANSWER" | "${DIALSTATUS}" = "NOANSWER"]?Busy(10))',
      );
    });

    it('filters invalid statuses from an array', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'busy',
          params: {},
          condition: { dialstatus: ['ANSWER', 'BOGUS'] },
        },
        vpbx,
      );
      expect(dp).toBe('ExecIf($["${DIALSTATUS}" = "ANSWER"]?Busy(10))');
    });

    it('emits no wrapper when all array statuses are invalid', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'busy',
          params: {},
          condition: { dialstatus: ['BOGUS', 'NOPE'] },
        },
        vpbx,
      );
      expect(dp).toBe('Busy(10)');
    });

    it('emits NoOp for a single invalid dialstatus (legacy path)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'busy', params: {}, condition: { dialstatus: 'BOGUS' } },
        vpbx,
      );
      expect(dp).toContain('NoOp(Invalid dialstatus:');
    });
  });

  describe('hangup causecode', () => {
    it('emits Hangup(causecode) when causecode is non-empty', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'hangup', params: { causecode: '17' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Hangup(17)');
    });

    it('emits Hangup() when causecode is empty', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'hangup', params: { causecode: '' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Hangup()');
    });

    it('emits Hangup() when causecode is absent', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'hangup', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Hangup()');
    });
  });

  describe('congestion (type only — generator branch is 12-05)', () => {
    it('currently falls through to Unknown action NoOp', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'congestion', params: { timeout: 10 }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp(Unknown action: congestion)');
    });
  });

  describe('togroup', () => {
    it('emits Gosub(group_<uid>_<vpbx>,start,1)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'togroup', params: { group: '15' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Gosub(group_15_42,start,1)');
    });
  });

  describe('notify', () => {
    const prevKey = AsteriskDialplanUtils.dialplanApiKey;
    const prevUrl = AsteriskDialplanUtils.backendBaseUrl;

    beforeEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'test-key';
    });

    afterEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
    });

    it('emits Set(__KNOTIFY_*) and CURL to internal/dialplan/notify with URIENCODE', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'notify',
          params: {
            integration_uid: 15,
            message: 'Call from ${CALLERID(num)}',
            target: '12345',
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('Set(__KNOTIFY_MSG=Call from ${CALLERID(num)})');
      expect(dp).toContain('internal/dialplan/notify');
      expect(dp).toContain('integration_uid=15');
      expect(dp).toContain('message=${URIENCODE(${KNOTIFY_MSG})}');
      expect(dp).toContain('URIENCODE');
      expect(dp).toContain('api_key=');
    });
  });

  describe('callerid', () => {
    const prevKey = AsteriskDialplanUtils.dialplanApiKey;
    const prevUrl = AsteriskDialplanUtils.backendBaseUrl;

    beforeEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'pb-key';
    });

    afterEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
    });

    it('mode static emits Set(CALLERID(num)=...) and optional name', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'callerid',
          params: { mode: 'static', callerid: '79001112233', name: 'Sales' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('Set(CALLERID(num)=79001112233)');
      expect(dp).toContain('Set(CALLERID(name)=Sales)');
    });

    it('mode phonebook emits CURL lookup and CUT to set CALLERID(num)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'callerid',
          params: { mode: 'phonebook', phonebook_uid: 7 },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('internal/dialplan/phonebook-lookup');
      expect(dp).toContain('phonebook_uid=7');
      expect(dp).toContain('CUT(');
      expect(dp).toContain('Set(CALLERID(num)=');
    });

    it('mode setclid_list preserves exten_setclid.php SHELL branch', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'callerid',
          params: { mode: 'setclid_list', list_uid: 5 },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('exten_setclid.php');
      expect(dp).toContain('"5"');
    });

    it('mode carousel emits CID pool then nested RAND selection', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'callerid',
          params: {
            mode: 'carousel',
            pool: ['79001112233', '79004445566', '79007778899'],
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('Set(CID_1=79001112233)');
      expect(dp).toContain('Set(CID_2=79004445566)');
      expect(dp).toContain('Set(CID_3=79007778899)');
      expect(dp).toContain('Set(CALLERID(num)=${CID_${RAND(1,3)}})');
    });
  });

  describe('trunk_carousel', () => {
    const prevKey = AsteriskDialplanUtils.dialplanApiKey;
    const prevUrl = AsteriskDialplanUtils.backendBaseUrl;

    beforeEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'tc-key';
    });

    afterEach(() => {
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
    });

    it('emits random_then_failover Dial loop with Return and no Hangup', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'trunk_carousel',
          params: {
            mode: 'random_then_failover',
            trunks: [
              { trunk: 'PJSIP/trunkA', cid_mode: 'static', callerid: '79001112233' },
              { trunk: 'PJSIP/trunkB', cid_mode: 'phonebook', phonebook_uid: 3 },
            ],
            timeout: 60,
            options: 'tT',
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('RAND');
      expect(dp).toContain('Return()');
      expect(dp).not.toContain('Hangup');
      expect(dp).toContain('Dial(PJSIP/trunkA/${EXTEN}');
      expect(dp).toContain('Dial(PJSIP/trunkB/${EXTEN}');
      expect(dp).toContain('Set(CALLERID(num)=79001112233)');
      expect(dp).toContain('phonebook-lookup');
    });
  });

  describe('pjsipDialTarget / toexten', () => {
    it('forks primary + webrtc companion by default', () => {
      expect(AsteriskDialplanUtils.pjsipDialTarget('110', vpbx)).toBe(
        'PJSIP/e110_42&PJSIP/ew110_42',
      );
    });

    it('returns primary only when webrtc=false', () => {
      expect(AsteriskDialplanUtils.pjsipDialTarget('110', vpbx, { webrtc: false })).toBe(
        'PJSIP/e110_42',
      );
    });

    it('toexten Dial forks companion for a specific extension', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toexten', params: { exten: '101', timeout: '20' }, condition: {} },
        vpbx,
      );
      expect(dp).toContain('Dial(PJSIP/e101_42&PJSIP/ew101_42,20,');
    });

    it('toexten with webrtc=false dials primary only', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toexten',
          params: { exten: '101', timeout: '20', webrtc: false },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('Dial(PJSIP/e101_42,20,');
      expect(dp).not.toContain('ew101');
    });
  });

  describe('characterization (Wave 0) — freezes current output before Phase 12 refactor', () => {
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

    it('totrunk uses registry dest ${EXTEN} after sanitizeDialplanInput (strips $ {})', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'totrunk',
          params: { trunk: 'PJSIP/out1', dest: '${EXTEN}', timeout: 60, options: 'tT' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Dial(PJSIP/out1/EXTEN,60,tT)');
    });

    it('totrunk empty dest falls back to literal ${EXTEN}', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'totrunk',
          params: { trunk: 'PJSIP/out1', dest: '', timeout: 60, options: 'tT' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Dial(PJSIP/out1/${EXTEN},60,tT)');
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — wrapper/closing applied as if dp were a single line.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('characterizes current (defective) behaviour: totrunk wraps Dial when dialstatus is set', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'totrunk',
          params: { trunk: 'PJSIP/out1', dest: '', timeout: 60, options: 'tT' },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe(
        'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Dial(PJSIP/out1/${EXTEN},60,tT))',
      );
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — custom webhook makes totrunk multi-line; Return() is unwrapped.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('characterizes current (defective) behaviour: totrunk DIALTO block leaves Return() unwrapped', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'totrunk',
          params: { trunk: 'PJSIP/out1', dest: '', timeout: 60, options: 'tT' },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
        false,
        { custom: { url: 'http://crm.example/lookup' } },
      );
      expect(dp).toBe(
        [
          'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?ExecIf($["${DIALTO}" != ""]?Dial(PJSIP/out1/${DIALTO},15,tT)))',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Dial(PJSIP/out1/${EXTEN},60,tT))',
        ].join('\n'),
      );
    });

    it('toqueue with filled legacy queue emits tenant-scoped Queue(q{name}_{uid},…)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toqueue',
          params: { queue: 'sales', timeout: '30', options: 'thH' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Queue(qsales_42,thH,,,30)');
    });

    it('toqueue with route_pattern target emits Queue(q${EXTEN}_{uid},…)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toqueue',
          params: { target: { source: 'route_pattern' }, timeout: 60 },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('Queue(q${EXTEN}_42,');
    });

    it('toqueue with phonebook target emits lookup by var_key then Queue(q${PB_TARGET}_{uid})', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toqueue',
          params: {
            target: { source: 'phonebook', phonebookUid: 7, varKey: 'queue' },
            timeout: 30,
            options: 'thH',
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('internal/dialplan/phonebook-lookup');
      expect(dp).toContain('phonebook_uid=7');
      expect(dp).toContain('var_key=queue');
      expect(dp).toContain('Set(PB_TARGET=${CURL(');
      expect(dp).toContain('ExecIf($["${PB_TARGET}" != ""]?Queue(q${PB_TARGET}_42,thH,,,30))');
    });

    it('toqueue with empty params no longer emits raw ${EXTEN} (D-21, replaces 12-01 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toqueue', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).not.toBe('Queue(${EXTEN},thH,,,)');
      expect(dp).toBe('Queue(q${EXTEN}_42,thH,,,)');
    });

    it('toqueue registry empty-queue maps to route_pattern, not raw ${EXTEN}', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toqueue',
          params: { queue: '', timeout: '', options: 'thH' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Queue(q${EXTEN}_42,thH,,,)');
    });

    it('toivr with filled ivr_uid emits Goto(ivr_<uid>,start,1)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toivr', params: { ivr_uid: 7 }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Goto(ivr_7,start,1)');
    });

    it('toivr with registry defaultParams emits NoOp(Missing IVR UID)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toivr', params: { ivr_uid: '' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp(Missing IVR UID)');
    });

    it('voicerobot with filled robot_uid emits Stasis', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'voicerobot', params: { robot_uid: 9 }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Stasis(krasterisk_voicerobots,9)');
    });

    it('voicerobot with empty params emits NoOp(Missing Robot UID)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'voicerobot', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp(Missing Robot UID)');
    });

    it('tolist with UI numbers placeholder emits LOCAL Dial to ctx-<vpbx>', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'tolist',
          params: { numbers: '100,101,102', timeout: '30' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Dial(LOCAL/100@ctx-42&LOCAL/101@ctx-42&LOCAL/102@ctx-42,30,tT)');
    });

    it('tolist with empty params emits NoOp(Empty dial list)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'tolist', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp(Empty dial list)');
    });

    it('toroute with filled context concatenates tenant suffix (D-42 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toroute',
          params: { context: 'sip-out', extension: '100' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Goto(sip-out42,100,1)');
    });

    it('toroute with already-suffixed context double-appends tenant (D-42 defect)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toroute',
          params: { context: 'sip-out42', extension: '100' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Goto(sip-out4242,100,1)');
    });

    it('toroute with registry defaultParams uses sip-in + ${EXTEN}', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toroute', params: { context: '', extension: '' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Goto(sip-in42,${EXTEN},1)');
    });

    it('playprompt with filled file emits Playback under tenant sounds', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'playprompt', params: { file: 'welcome' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Playback(/usr/records/42/sounds/welcome)');
    });

    it('playprompt with registry defaultParams emits Playback with empty filename', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'playprompt', params: { file: '' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Playback(/usr/records/42/sounds/)');
    });

    it('playback with filled file emits Background under tenant sounds', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'playback', params: { file: 'menu' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Background(/usr/records/42/sounds/menu)');
    });

    it('playback with registry defaultParams emits Background with empty filename', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'playback', params: { file: '' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Background(/usr/records/42/sounds/)');
    });

    it('setclid_custom with filled callerid emits Set(CALLERID(num))', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'setclid_custom', params: { callerid: '79001112233' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Set(CALLERID(num)=79001112233)');
    });

    it('setclid_custom with registry defaultParams emits empty CALLERID(num)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'setclid_custom',
          params: { mode: 'static', callerid: '' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Set(CALLERID(num)=)');
    });

    it('setclid_list with filled list_uid emits dual SHELL() (D-37 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'setclid_list', params: { list_uid: 5 }, condition: {} },
        vpbx,
      );
      expect(dp).toBe(
        'ExecIf($["${SHELL(/usr/scripts/exten_setclid.php "5" "${CLIDNUM}")}" != ""]?Set(CALLERID(num)=${SHELL(/usr/scripts/exten_setclid.php "5" "${CLIDNUM}")}))',
      );
      expect(dp.split('SHELL(').length - 1).toBe(2);
    });

    it('setclid_list with registry defaultParams still emits dual SHELL()', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'setclid_list',
          params: { mode: 'setclid_list', list_uid: '' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe(
        'ExecIf($["${SHELL(/usr/scripts/exten_setclid.php "" "${CLIDNUM}")}" != ""]?Set(CALLERID(num)=${SHELL(/usr/scripts/exten_setclid.php "" "${CLIDNUM}")}))',
      );
      expect(dp.split('SHELL(').length - 1).toBe(2);
    });

    it('sendmail with UI fields emits Set(__KMAIL_*) then CURL', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'sendmail',
          params: {
            email: 'ops@example.com',
            subject: 'Call from ${CALLERID(num)}',
            text: 'Incoming on ${EXTEN}',
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe(
        [
          'Set(__KMAIL_TO=ops@example.com)',
          'same => n,Set(__KMAIL_SUBJ=Call from ${CALLERID(num)})',
          'same => n,Set(__KMAIL_TEXT=Incoming on ${EXTEN})',
          'same => n,Set(MAIL_RESULT=${CURL(http://backend.test/api/internal/dialplan/sendmail,to=${URIENCODE(${KMAIL_TO})}&subject=${URIENCODE(${KMAIL_SUBJ})}&text=${URIENCODE(${KMAIL_TEXT})}&api_key=wave0-key)})',
        ].join('\n'),
      );
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — wrapper/closing applied only to the first Set line.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('characterizes current (defective) behaviour: sendmail wraps only the first Set when dialstatus is set', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'sendmail',
          params: {
            email: 'ops@example.com',
            subject: 'Call from ${CALLERID(num)}',
            text: 'Incoming on ${EXTEN}',
          },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe(
        [
          'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(__KMAIL_TO=ops@example.com))',
          'same => n,Set(__KMAIL_SUBJ=Call from ${CALLERID(num)})',
          'same => n,Set(__KMAIL_TEXT=Incoming on ${EXTEN})',
          'same => n,Set(MAIL_RESULT=${CURL(http://backend.test/api/internal/dialplan/sendmail,to=${URIENCODE(${KMAIL_TO})}&subject=${URIENCODE(${KMAIL_SUBJ})}&text=${URIENCODE(${KMAIL_TEXT})}&api_key=wave0-key)})',
        ].join('\n'),
      );
    });

    it('sendmailpeer emits System(sendmailpeer.php …)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'sendmailpeer',
          params: { exten: '101', text: 'missed call' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe(
        'System(/usr/scripts/sendmailpeer.php "101" "missed call" "${CALLERID(num)}" "${EXTEN}" "${UNIQUEID}" "42")',
      );
    });

    it('telegram emits System(telegram.php …)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'telegram',
          params: { chat_id: '12345', text: 'hello' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe(
        'System(/usr/scripts/telegram.php "12345" "hello" "${CALLERID(num)}" "${EXTEN}" "${UNIQUEID}" "42")',
      );
    });

    it('voicemail with filled exten emits VoiceMail(exten@default,u)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'voicemail', params: { exten: '101' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('VoiceMail(101@default,u)');
    });

    it('voicemail with empty params substitutes ${EXTEN} (D-21 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'voicemail', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('VoiceMail(${EXTEN}@default,u)');
    });

    it('text2speech emits AGI(say.php,"…")', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'text2speech', params: { text: 'hello world' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('AGI(say.php,"hello world")');
    });

    it('asr with empty params uses default silence 3 / max 6', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'asr', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Record(/tmp/${UNIQUEID}.wav,3,6)');
    });

    it('asr with UI timers emits Record with those values', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'asr',
          params: { silence_timeout: '4', max_timer: '8' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Record(/tmp/${UNIQUEID}.wav,4,8)');
    });

    it('keywords with UI timers emits the same Record as asr', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'keywords',
          params: { silence_timeout: '4', max_timer: '8' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Record(/tmp/${UNIQUEID}.wav,4,8)');
    });

    it('webhook emits Set(WH_DATA=${SHELL(webhook.php …)})', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'webhook',
          params: { url: 'https://example.com/hook' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe(
        'Set(WH_DATA=${SHELL(/usr/scripts/webhook.php "https://example.com/hook" "${CALLERID(num)}" "${EXTEN}" "${UNIQUEID}" "42")})',
      );
    });

    it('confbridge with filled room emits ConfBridge(room)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'confbridge', params: { room: 'room1' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('ConfBridge(room1)');
    });

    it('confbridge with empty params substitutes ${EXTEN} (D-21 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'confbridge', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('ConfBridge(${EXTEN})');
    });

    it('cmd with isAdmin=true emits the raw command (D-42 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'cmd', params: { command: 'NoOp(hello)' }, condition: {} },
        vpbx,
        true,
      );
      expect(dp).toBe('NoOp(hello)');
    });

    it('cmd with isAdmin=false emits Unauthorized NoOp (D-42 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'cmd', params: { command: 'NoOp(hello)' }, condition: {} },
        vpbx,
        false,
      );
      expect(dp).toBe('NoOp(Unauthorized cmd action)');
    });

    it('cmd with isAdmin=true and empty command emits NoOp()', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'cmd', params: {}, condition: {} },
        vpbx,
        true,
      );
      expect(dp).toBe('NoOp()');
    });

    it('tofax emits Set(__faxmail=…)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'tofax', params: { email: 'fax@example.com' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Set(__faxmail=fax@example.com)');
    });

    it('label without condition emits NoOp() and ignores label_name', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'label', params: { label_name: 'after-dial' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp()');
    });

    /**
     * 12-RESEARCH.md Pitfall 4 — closing ')' is appended without wrapper → NoOp()).
     * 12-05 must rewrite this expectation after wrapCondition / priority labels.
     */
    it('characterizes current (defective) behaviour: label with dialstatus emits invalid NoOp())', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'label',
          params: { label_name: 'after-dial' },
          condition: { dialstatus: 'ANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe('NoOp())');
    });

    it('toexten with empty params emits empty string (skip)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toexten', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('');
    });

    it('togroup with empty params substitutes ${EXTEN} (D-21 baseline)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'togroup', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Gosub(group_${EXTEN}_42,start,1)');
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — toexten is single-line without webhook; wrapper still applied.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('characterizes current (defective) behaviour: toexten wraps Dial when dialstatus is set', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toexten',
          params: { exten: '101', timeout: 60, options: 'tThH' },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe(
        'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Dial(PJSIP/e101_42&PJSIP/ew101_42,60,tThH))',
      );
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — custom webhook makes toexten multi-line; Return() is unwrapped.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('characterizes current (defective) behaviour: toexten DIALTO block leaves Return() unwrapped', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toexten',
          params: { exten: '101', timeout: 60, options: 'tThH' },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
        false,
        { custom: { url: 'http://crm.example/lookup' } },
      );
      expect(dp).toBe(
        [
          'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?ExecIf($["${DIALTO}" != ""]?Dial(PJSIP/e${DIALTO}_42&PJSIP/ew${DIALTO}_42,15,tThH)))',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Dial(PJSIP/e101_42&PJSIP/ew101_42,60,tThH))',
        ].join('\n'),
      );
    });

    it('notify with UI fields emits Set(__KNOTIFY_*) then CURL', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'notify',
          params: {
            integration_uid: 15,
            message: 'Call from ${CALLERID(num)}',
            target: '12345',
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe(
        [
          'Set(__KNOTIFY_MSG=Call from ${CALLERID(num)})',
          'same => n,Set(__KNOTIFY_TARGET=12345)',
          'same => n,Set(NOTIFY_RESULT=${CURL(http://backend.test/api/internal/dialplan/notify,integration_uid=15&message=${URIENCODE(${KNOTIFY_MSG})}&target=${URIENCODE(${KNOTIFY_TARGET})}&clid=${URIENCODE(${CALLERID(num)})}&exten=${URIENCODE(${EXTEN})}&uniqueid=${URIENCODE(${UNIQUEID})}&api_key=wave0-key)})',
        ].join('\n'),
      );
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — wrapper/closing applied only to the first Set line.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('characterizes current (defective) behaviour: notify wraps only the first Set when dialstatus is set', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'notify',
          params: {
            integration_uid: 15,
            message: 'Call from ${CALLERID(num)}',
            target: '12345',
          },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe(
        [
          'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(__KNOTIFY_MSG=Call from ${CALLERID(num)}))',
          'same => n,Set(__KNOTIFY_TARGET=12345)',
          'same => n,Set(NOTIFY_RESULT=${CURL(http://backend.test/api/internal/dialplan/notify,integration_uid=15&message=${URIENCODE(${KNOTIFY_MSG})}&target=${URIENCODE(${KNOTIFY_TARGET})}&clid=${URIENCODE(${CALLERID(num)})}&exten=${URIENCODE(${EXTEN})}&uniqueid=${URIENCODE(${UNIQUEID})}&api_key=wave0-key)})',
        ].join('\n'),
      );
    });

    it('callerid static with name emits two Set lines', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'callerid',
          params: { mode: 'static', callerid: '79001112233', name: 'Sales' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe(
        ['Set(CALLERID(num)=79001112233)', 'same => n,Set(CALLERID(name)=Sales)'].join('\n'),
      );
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — wrapper/closing applied only to the first Set line.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('characterizes current (defective) behaviour: callerid wraps only the first Set when dialstatus is set', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'callerid',
          params: { mode: 'static', callerid: '79001112233', name: 'Sales' },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe(
        [
          'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(CALLERID(num)=79001112233))',
          'same => n,Set(CALLERID(name)=Sales)',
        ].join('\n'),
      );
    });

    it('trunk_carousel with five trunks emits 25 Dial() blocks (D-36 O(n²) baseline)', () => {
      const trunks = [1, 2, 3, 4, 5].map((i) => ({
        trunk: `PJSIP/t${i}`,
        cid_mode: 'static',
        callerid: `7900111000${i}`,
      }));
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'trunk_carousel',
          params: {
            mode: 'random_then_failover',
            trunks,
            timeout: 60,
            options: 'tT',
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp.split('Dial(').length - 1).toBe(25);
      expect(dp).toBe(
        [
          'Set(TC_PICK=${RAND(1,5)})',
          'same => n,GotoIf($["${TC_PICK}" = "1"]?t1)',
          'same => n,GotoIf($["${TC_PICK}" = "2"]?t2)',
          'same => n,GotoIf($["${TC_PICK}" = "3"]?t3)',
          'same => n,GotoIf($["${TC_PICK}" = "4"]?t4)',
          'same => n,Goto(t5)',
          'same => n(t1),Set(CALLERID(num)=79001110001)',
          'same => n,Dial(PJSIP/t1/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110002)',
          'same => n,Dial(PJSIP/t2/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110003)',
          'same => n,Dial(PJSIP/t3/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110004)',
          'same => n,Dial(PJSIP/t4/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110005)',
          'same => n,Dial(PJSIP/t5/${EXTEN},60,tT)',
          'same => n,Return()',
          'same => n(t2),Set(CALLERID(num)=79001110002)',
          'same => n,Dial(PJSIP/t2/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110003)',
          'same => n,Dial(PJSIP/t3/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110004)',
          'same => n,Dial(PJSIP/t4/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110005)',
          'same => n,Dial(PJSIP/t5/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110001)',
          'same => n,Dial(PJSIP/t1/${EXTEN},60,tT)',
          'same => n,Return()',
          'same => n(t3),Set(CALLERID(num)=79001110003)',
          'same => n,Dial(PJSIP/t3/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110004)',
          'same => n,Dial(PJSIP/t4/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110005)',
          'same => n,Dial(PJSIP/t5/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110001)',
          'same => n,Dial(PJSIP/t1/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110002)',
          'same => n,Dial(PJSIP/t2/${EXTEN},60,tT)',
          'same => n,Return()',
          'same => n(t4),Set(CALLERID(num)=79001110004)',
          'same => n,Dial(PJSIP/t4/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110005)',
          'same => n,Dial(PJSIP/t5/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110001)',
          'same => n,Dial(PJSIP/t1/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110002)',
          'same => n,Dial(PJSIP/t2/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110003)',
          'same => n,Dial(PJSIP/t3/${EXTEN},60,tT)',
          'same => n,Return()',
          'same => n(t5),Set(CALLERID(num)=79001110005)',
          'same => n,Dial(PJSIP/t5/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110001)',
          'same => n,Dial(PJSIP/t1/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110002)',
          'same => n,Dial(PJSIP/t2/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110003)',
          'same => n,Dial(PJSIP/t3/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110004)',
          'same => n,Dial(PJSIP/t4/${EXTEN},60,tT)',
          'same => n,Return()',
        ].join('\n'),
      );
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — wrapper/closing applied only to the first Set(TC_PICK) line.
     * 12-05 must rewrite this expectation after wrapEachLine / GotoIf.
     */
    it('toexten useExten dials PJSIP/e${EXTEN}_<vpbx> fork', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toexten',
          params: { useExten: true, timeout: 60, options: 'tThH' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Dial(PJSIP/e${EXTEN}_42&PJSIP/ew${EXTEN}_42,60,tThH)');
    });

    it('callerid carousel with empty pool emits NoOp', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'callerid', params: { mode: 'carousel', pool: [] }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp(Empty CID carousel pool)');
    });

    it('callerid unknown mode emits NoOp', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'callerid', params: { mode: 'nope' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp(Unknown callerid mode)');
    });

    it('unknown ActionType hits default NoOp', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'not-a-real-type', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp(Unknown action: not-a-real-type)');
    });

    it('toexten injects U(krsk-on-answer) when on_answer webhook is set', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toexten',
          params: { exten: '101', timeout: 60, options: 'tThH' },
          condition: {},
        },
        vpbx,
        false,
        { on_answer: { url: 'http://crm.example/answered' } },
      );
      expect(dp).toBe(
        'Dial(PJSIP/e101_42&PJSIP/ew101_42,60,tThHU(krsk-on-answer,s,1(dial)))',
      );
    });

    it('characterizes current (defective) behaviour: trunk_carousel wraps only TC_PICK when dialstatus is set', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'trunk_carousel',
          params: {
            mode: 'random_then_failover',
            trunks: [
              { trunk: 'PJSIP/t1', cid_mode: 'static', callerid: '79001110001' },
              { trunk: 'PJSIP/t2', cid_mode: 'static', callerid: '79001110002' },
            ],
            timeout: 60,
            options: 'tT',
          },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe(
        [
          'ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(TC_PICK=${RAND(1,2)}))',
          'same => n,GotoIf($["${TC_PICK}" = "1"]?t1)',
          'same => n,Goto(t2)',
          'same => n(t1),Set(CALLERID(num)=79001110001)',
          'same => n,Dial(PJSIP/t1/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110002)',
          'same => n,Dial(PJSIP/t2/${EXTEN},60,tT)',
          'same => n,Return()',
          'same => n(t2),Set(CALLERID(num)=79001110002)',
          'same => n,Dial(PJSIP/t2/${EXTEN},60,tT)',
          'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
          'same => n,Set(CALLERID(num)=79001110001)',
          'same => n,Dial(PJSIP/t1/${EXTEN},60,tT)',
          'same => n,Return()',
        ].join('\n'),
      );
    });
  });
});

describe('characterization completeness (Wave 0 gate)', () => {
  const vpbx = 42;

  function parseActionTypesListFromDto(): string[] {
    const dtoPath = path.join(__dirname, '../../modules/routes/dto/route-action.dto.ts');
    const src = fs.readFileSync(dtoPath, 'utf8');
    const match = src.match(/const ActionTypesList = \[([\s\S]*?)\];/);
    if (!match) {
      throw new Error(`ActionTypesList not found in ${dtoPath}`);
    }
    return match[1]
      .split(',')
      .map((s) => s.replace(/['"\s]/g, ''))
      .filter(Boolean);
  }

  it('actionToDialplan does not throw for every ActionType with empty params', () => {
    for (const type of ACTION_TYPES) {
      expect(() =>
        AsteriskDialplanUtils.actionToDialplan({ type, params: {}, condition: {} }, vpbx),
      ).not.toThrow();
    }
  });

  it('ActionType (shared) and ActionTypesList (DTO) are the same set (Pitfall 5 / D-08)', () => {
    const fromDto = new Set(parseActionTypesListFromDto());
    const fromShared = new Set<string>(ACTION_TYPES);
    const missingInDto = [...fromShared].filter((t) => !fromDto.has(t));
    const extraInDto = [...fromDto].filter((t) => !fromShared.has(t));
    expect({ missingInDto, extraInDto }).toEqual({ missingInDto: [], extraInDto: [] });
  });

  it('CHARACTERIZED_TYPES covers every ActionType', () => {
    const characterized = new Set(CHARACTERIZED_TYPES);
    const required = new Set<string>(ACTION_TYPES);
    const missing = [...required].filter((t) => !characterized.has(t as ActionType));
    if (missing.length) {
      throw new Error(`Uncharacterized ActionType(s): ${missing.join(', ')}`);
    }
  });
});
