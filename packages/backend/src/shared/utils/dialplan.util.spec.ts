import * as fs from 'fs';
import * as path from 'path';
import type { ActionType } from '@krasterisk/shared';
import { DIALPLAN_ACTION_META } from '@krasterisk/shared';
import { ActionTypesList } from '../../modules/routes/dto/route-action.dto';
import { ActionLog } from '../../modules/logger/action-log.model';
import {
  AsteriskDialplanUtils,
  emitDigitExitTransition,
  findUnreachableSteps,
  renderActionChain,
} from './dialplan.util';
import { decodeCurlPostData, extractCurlInvocation } from './dialplan-curl.util';

jest.mock('../../modules/logger/action-log.model', () => ({
  ActionLog: { create: jest.fn().mockResolvedValue({}) },
}));

/** Runtime copy of the shared ActionType union — compile-fails if a member is missing. */
const ACTION_TYPES = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  'toivr', 'toroute', 'playback',
  'setclid_custom', 'setclid_list',
  'notify', 'callerid', 'trunk_carousel',
  'voicemail', 'text2speech', 'voicerobot',
  'webhook', 'confbridge', 'cmd',
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
  'toivr', 'toroute', 'playback',
  'setclid_custom', 'setclid_list',
  'notify', 'callerid', 'trunk_carousel',
  'voicemail', 'text2speech', 'voicerobot',
  'webhook', 'confbridge', 'cmd',
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

  describe('congestion (D-42 generator branch)', () => {
    it('emits Congestion() like busy — 12-RESEARCH Pitfall / 12-03 type already registered', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'congestion', params: {}, condition: {} },
        vpbx,
      );
      expect(dp).toContain('Congestion()');
      expect(dp).toBe('Congestion()');
      expect(DIALPLAN_ACTION_META.congestion.terminal).toBe('always');
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

    it('notify email payload emits CURL to /internal/dialplan/notify (D-28)', () => {
      const notify = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'notify',
          params: {
            channels: ['email'],
            recipients: { email: 'ops@example.com' },
            subject: 'Call',
            body: 'Incoming',
          },
          condition: {},
        },
        vpbx,
      );
      const notifyCurl = extractCurlInvocation(notify);
      expect(notifyCurl).toContain('/internal/dialplan/notify');
    });

    it('notify failure does not stop later steps in the chain', () => {
      const dp = renderActionChain(
        [
          { type: 'notify', params: { channels: ['email'], recipients: { email: 'a@b.c' }, body: 'x' }, condition: {} },
          { type: 'busy', params: {}, condition: {} },
        ],
        { vpbxUserUid: vpbx, host: 'route' },
      );
      expect(dp).toContain('/internal/dialplan/notify');
      expect(dp).toContain('Busy(');
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

    it('mode setclid_list emits CURL to internal setclid (D-31)', () => {
      const prevUrl = AsteriskDialplanUtils.backendBaseUrl;
      const prevKey = AsteriskDialplanUtils.dialplanApiKey;
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'callerid',
          params: { mode: 'setclid_list', list_uid: 5 },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('CURL(');
      expect(dp).toContain('/internal/dialplan/setclid');
      expect(dp).toContain('KRSK_HTTP_RESULT');
      expect(dp).not.toContain('SHELL(');
      expect(dp).not.toContain('usr/scripts');
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
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
     * 12-RESEARCH.md Pitfall 3 — now wrapEachLine; single-line Dial output unchanged.
     */
    it('totrunk wraps Dial when dialstatus is set (wrapEachLine, single line)', () => {
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
     * 12-RESEARCH.md Pitfall 3 — wrapEachLine now wraps Return() as well as Dial.
     */
    it('totrunk DIALTO block wraps every line including Return() (Pitfall 3)', () => {
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
          'same => n,ExecIf($["${DIALSTATUS}" = "NOANSWER"]?ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return()))',
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

    it('toivr with filled ivr_uid emits hop-prologue then Goto(ivr_<uid>,start,1)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toivr', params: { ivr_uid: 7 }, condition: {} },
        vpbx,
      );
      expect(dp).toBe([
        'Set(__KRSK_HOPS=$[${__KRSK_HOPS} + 1])',
        'same => n,GotoIf($[${__KRSK_HOPS} <= 10]?ivr_7,start,1)',
        'same => n,NoOp(KRSK hop limit exceeded route=ivr_7)',
        'same => n,Congestion()',
      ].join('\n'));
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
      expect(dp).toBe([
        'Set(__KRSK_HOPS=$[${__KRSK_HOPS} + 1])',
        'same => n,GotoIf($[${__KRSK_HOPS} <= 10]?sip-out42,100,1)',
        'same => n,NoOp(KRSK hop limit exceeded route=sip-out42)',
        'same => n,Congestion()',
      ].join('\n'));
    });

    /**
     * 12-RESEARCH / D-21 — normalizeTarget endsWith guard; Wave 0 froze the double suffix.
     */
    it('toroute with already-suffixed context keeps a single tenant suffix (D-21)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'toroute',
          params: { context: 'sip-out42', extension: '100' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe([
        'Set(__KRSK_HOPS=$[${__KRSK_HOPS} + 1])',
        'same => n,GotoIf($[${__KRSK_HOPS} <= 10]?sip-out42,100,1)',
        'same => n,NoOp(KRSK hop limit exceeded route=sip-out42)',
        'same => n,Congestion()',
      ].join('\n'));
    });

    it('toroute with registry defaultParams uses sip-in + ${EXTEN}', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toroute', params: { context: '', extension: '' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe([
        'Set(__KRSK_HOPS=$[${__KRSK_HOPS} + 1])',
        'same => n,GotoIf($[${__KRSK_HOPS} <= 10]?sip-in42,${EXTEN},1)',
        'same => n,NoOp(KRSK hop limit exceeded route=sip-in42)',
        'same => n,Congestion()',
      ].join('\n'));
    });

    it('playback without mode defaults to plain Playback via emitPlayback', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'playback', params: { file: 'menu' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Playback(/usr/records/42/sounds/menu)');
    });

    it('playback with empty file emits Playback with empty filename', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'playback', params: { file: '' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('Playback(/usr/records/42/sounds/)');
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

    it('setclid_list with filled list_uid emits CURL setclid (D-31)', () => {
      const prevUrl = AsteriskDialplanUtils.backendBaseUrl;
      const prevKey = AsteriskDialplanUtils.dialplanApiKey;
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'setclid_list', params: { list_uid: 5 }, condition: {} },
        vpbx,
      );
      expect(dp).toContain('Set(CURLOPT(httptimeout)=');
      expect(dp).toContain('Set(KRSK_HTTP_RESULT=${CURL(http://backend.test/api/internal/dialplan/setclid');
      expect(dp).toContain('list_uid=5');
      expect(dp).toContain('ExecIf($["${KRSK_HTTP_RESULT}" != ""]?Set(CALLERID(num)=${KRSK_HTTP_RESULT}))');
      expect(dp).not.toContain('SHELL(');
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
    });

    it('setclid_list with registry defaultParams still emits CURL setclid', () => {
      const prevUrl = AsteriskDialplanUtils.backendBaseUrl;
      const prevKey = AsteriskDialplanUtils.dialplanApiKey;
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'setclid_list',
          params: { mode: 'setclid_list', list_uid: '' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('/internal/dialplan/setclid');
      expect(dp).toContain('CURL(');
      expect(dp).not.toContain('SHELL(');
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
    });

    it('notify wraps every Set/CURL line when dialstatus is set (Pitfall 3)', () => {
      const prevUrl = AsteriskDialplanUtils.backendBaseUrl;
      const prevKey = AsteriskDialplanUtils.dialplanApiKey;
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'notify',
          params: {
            channels: ['email'],
            recipients: { email: 'ops@example.com' },
            subject: 'Call from ${CALLERID(num)}',
            body: 'Incoming on ${EXTEN}',
          },
          condition: { dialstatus: 'NOANSWER' },
        },
        vpbx,
      );
      expect(dp).toContain('ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(__KNOTIFY_MSG=');
      expect(dp).toContain('ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(CURLOPT(httptimeout)=');
      expect(dp).toContain('/internal/dialplan/notify');
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
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

    it('text2speech emits CURL to internal tts then Playback of the result (D-30)', () => {
      const prevUrl = AsteriskDialplanUtils.backendBaseUrl;
      const prevKey = AsteriskDialplanUtils.dialplanApiKey;
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'text2speech', params: { text: 'hello world' }, condition: {} },
        vpbx,
      );
      expect(dp).toContain('/internal/dialplan/tts');
      expect(dp).toContain('CURL(');
      expect(dp).toContain('Playback(/usr/records/42/sounds/${KRSK_HTTP_RESULT})');
      expect(dp).not.toContain('AGI(');
      expect(dp).not.toContain('usr/scripts');
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
    });

    it('webhook emits CURL to internal webhook (D-31)', () => {
      const prevUrl = AsteriskDialplanUtils.backendBaseUrl;
      const prevKey = AsteriskDialplanUtils.dialplanApiKey;
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'webhook',
          params: { url: 'https://example.com/hook' },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toContain('/internal/dialplan/webhook');
      expect(dp).toContain('Set(KRSK_HTTP_RESULT=${CURL(');
      expect(dp).not.toContain('SHELL(');
      expect(dp).not.toContain('usr/scripts');
      AsteriskDialplanUtils.backendBaseUrl = prevUrl;
      AsteriskDialplanUtils.dialplanApiKey = prevKey;
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

    it('label without condition emits NoOp() and ignores label_name', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'label', params: { label_name: 'after-dial' }, condition: {} },
        vpbx,
      );
      expect(dp).toBe('NoOp()');
    });

    /**
     * 12-RESEARCH.md Pitfall 4 — label no longer emits unbalanced NoOp()); wrapEachLine owns the condition.
     */
    it('label with dialstatus emits balanced ExecIf(...?NoOp()) (Pitfall 4)', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'label',
          params: { label_name: 'after-dial' },
          condition: { dialstatus: 'ANSWER' },
        },
        vpbx,
      );
      expect(dp).toBe('ExecIf($["${DIALSTATUS}" = "ANSWER"]?NoOp())');
      expect((dp.match(/\(/g) || []).length).toBe((dp.match(/\)/g) || []).length);
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
     * 12-RESEARCH.md Pitfall 3 — wrapEachLine; single-line Dial output unchanged.
     */
    it('toexten wraps Dial when dialstatus is set (wrapEachLine, single line)', () => {
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
     * 12-RESEARCH.md Pitfall 3 — wrapEachLine now wraps Return() as well as Dial.
     */
    it('toexten DIALTO block wraps every line including Return() (Pitfall 3)', () => {
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
          'same => n,ExecIf($["${DIALSTATUS}" = "NOANSWER"]?ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return()))',
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
      expect(dp).toContain('Set(__KNOTIFY_MSG=Call from ${CALLERID(num)})');
      expect(dp).toContain('Set(__KNOTIFY_TARGET=12345)');
      expect(dp).toContain('/internal/dialplan/notify');
      expect(dp).toContain('integration_uid=15');
      expect(dp).toContain('message=${URIENCODE(${KNOTIFY_MSG})}');
      expect(dp).toContain('Set(KRSK_HTTP_RESULT=${CURL(');
    });

    /**
     * 12-RESEARCH.md Pitfall 3 — wrapEachLine applies the condition to every notify line.
     */
    it('notify wraps every Set/CURL line when dialstatus is set (Pitfall 3)', () => {
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
      expect(dp).toContain('ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(__KNOTIFY_MSG=Call from ${CALLERID(num)}))');
      expect(dp).toContain('ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(__KNOTIFY_TARGET=12345))');
      expect(dp).toContain('/internal/dialplan/notify');
      expect((dp.match(/ExecIf\(/g) || []).length).toBeGreaterThanOrEqual(3);
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
     * 12-RESEARCH.md Pitfall 3 — wrapEachLine applies the condition to every callerid line.
     */
    it('callerid wraps every Set line when dialstatus is set (Pitfall 3)', () => {
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
          'same => n,ExecIf($["${DIALSTATUS}" = "NOANSWER"]?Set(CALLERID(name)=Sales))',
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

    /**
     * 12-RESEARCH.md Pitfall 3 — wrapEachLine covers every carousel line; Goto → GotoIf.
     */
    it('trunk_carousel wraps every line when dialstatus is set (Pitfall 3)', () => {
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
      const g = '"${DIALSTATUS}" = "NOANSWER"';
      expect(dp).toBe(
        [
          `ExecIf($[${g}]?Set(TC_PICK=\${RAND(1,2)}))`,
          `same => n,GotoIf($[(${g}) & ("\${TC_PICK}" = "1")]?t1)`,
          `same => n,GotoIf($[${g}]?t2)`,
          `same => n(t1),ExecIf($[${g}]?Set(CALLERID(num)=79001110001))`,
          `same => n,ExecIf($[${g}]?Dial(PJSIP/t1/\${EXTEN},60,tT))`,
          `same => n,ExecIf($[${g}]?ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return()))`,
          `same => n,ExecIf($[${g}]?Set(CALLERID(num)=79001110002))`,
          `same => n,ExecIf($[${g}]?Dial(PJSIP/t2/\${EXTEN},60,tT))`,
          `same => n,ExecIf($[${g}]?Return())`,
          `same => n(t2),ExecIf($[${g}]?Set(CALLERID(num)=79001110002))`,
          `same => n,ExecIf($[${g}]?Dial(PJSIP/t2/\${EXTEN},60,tT))`,
          `same => n,ExecIf($[${g}]?ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return()))`,
          `same => n,ExecIf($[${g}]?Set(CALLERID(num)=79001110001))`,
          `same => n,ExecIf($[${g}]?Dial(PJSIP/t1/\${EXTEN},60,tT))`,
          `same => n,ExecIf($[${g}]?Return())`,
        ].join('\n'),
      );
    });
  });

  describe('D-43 wrapEachLine / D-42 cmd log / bracket balance', () => {
    beforeEach(() => {
      (ActionLog.create as jest.Mock).mockClear();
    });

    const FIXTURE_PARAMS: Record<string, Record<string, unknown>> = {
      totrunk: { trunk: 'PJSIP/t1', dest: '7900' },
      toexten: { exten: '101' },
      toqueue: { queue: 'sales' },
      togroup: { group: '15' },
      tolist: { numbers: '101' },
      toivr: { ivr_uid: 1 },
      toroute: { context: 'sip-in', extension: '100' },
      playback: { file: 'welcome', mode: 'plain' },
      setclid_custom: { callerid: '7900' },
      setclid_list: { list_uid: 1 },
      notify: { integration_uid: 1, message: 'm', target: 't' },
      callerid: { mode: 'static', callerid: '7900', name: 'N' },
      trunk_carousel: { trunks: [{ trunk: 'PJSIP/t1', cid_mode: 'static', callerid: '1' }] },
      voicemail: { exten: '101' },
      text2speech: { text: 'hi' },
      voicerobot: { robot_uid: 1 },
      webhook: { url: 'http://x' },
      confbridge: { room: '100' },
      cmd: { command: 'NoOp(ok)' },
      label: { label_name: 'x' },
      busy: {},
      hangup: {},
      congestion: {},
    };

    it.each([...ActionTypesList])('emits balanced parentheses for %s', (type) => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type, params: FIXTURE_PARAMS[type] ?? {}, condition: { dialstatus: 'ANSWER' } },
        vpbx,
        true,
      );
      expect((dp.match(/\(/g) || []).length).toBe((dp.match(/\)/g) || []).length);
    });

    it('empty condition output equals output without condition (toBe)', () => {
      const action = { type: 'busy' as const, params: {}, condition: {} };
      const withEmpty = AsteriskDialplanUtils.actionToDialplan(action, vpbx);
      const without = AsteriskDialplanUtils.actionToDialplan({ type: 'busy', params: {} }, vpbx);
      expect(withEmpty).toBe(without);
      expect(withEmpty).toBe('Busy(10)');
    });

    it('cmd apply writes action_logs via ActionLog.create (D-42)', () => {
      AsteriskDialplanUtils.actionToDialplan(
        { id: 9, type: 'cmd', params: { command: 'NoOp(hello-from-cmd)' }, condition: {} },
        vpbx,
        true,
      );
      expect(ActionLog.create).toHaveBeenCalled();
      const payload = (ActionLog.create as jest.Mock).mock.calls[0][0];
      expect(payload.action).toBe('cmd_apply');
      expect(payload.entity_type).toBe('dialplan_action');
      expect(payload.details).toMatch(/cmd/);
    });

    it('chain without cmd does not log cmd_apply', () => {
      AsteriskDialplanUtils.actionToDialplan(
        { type: 'busy', params: {}, condition: {} },
        vpbx,
      );
      const cmdApplies = (ActionLog.create as jest.Mock).mock.calls.filter(
        (c) => c[0]?.action === 'cmd_apply',
      );
      expect(cmdApplies).toHaveLength(0);
    });

    it('cmd with isAdmin=false does not log cmd_apply', () => {
      AsteriskDialplanUtils.actionToDialplan(
        { type: 'cmd', params: { command: 'NoOp(x)' }, condition: {} },
        vpbx,
        false,
      );
      expect(ActionLog.create).not.toHaveBeenCalled();
    });
  });

  describe('renderActionChain (D-42 / D-43)', () => {
    it('time-group wrap is outside the step condition (indexOf)', () => {
      const dp = renderActionChain(
        [{ type: 'hangup', params: {}, condition: { dialstatus: 'ANSWER', time_group_uid: 12 } }],
        { vpbxUserUid: vpbx, host: 'route' },
      );
      expect(dp.indexOf('WT_12')).toBeGreaterThan(-1);
      expect(dp.indexOf('WT_12')).toBeLessThan(dp.indexOf('DIALSTATUS'));
    });

    it('address kinds tenant-suffix via normalizeTarget and skip raw ${EXTEN} as the whole dest', () => {
      const sources = [
        { source: 'fixed' as const, value: '101' },
        { source: 'route_pattern' as const },
        { source: 'variable' as const, name: 'MYVAR' },
        { source: 'phonebook' as const, phonebookUid: 7, varKey: 'n' },
      ];
      const cases: Array<{ type: string; params: (src: (typeof sources)[number]) => Record<string, unknown> }> = [
        { type: 'toexten', params: (src) => ({ target: src, timeout: 30 }) },
        { type: 'togroup', params: (src) => ({ target: src }) },
        { type: 'toroute', params: (src) => ({ context: 'sip-in', extension: src }) },
        { type: 'totrunk', params: (src) => ({ trunk: 'PJSIP/out1', dest: src, timeout: 60, options: 'tT' }) },
      ];
      for (const c of cases) {
        for (const src of sources) {
          const dp = AsteriskDialplanUtils.actionToDialplan(
            { type: c.type, params: c.params(src), condition: {} },
            vpbx,
          );
          if (c.type !== 'totrunk') expect(dp).toMatch(/_42|42,/);
          expect(dp).not.toMatch(/Dial\(\$\{EXTEN\}/);
          expect(dp).not.toMatch(/Queue\(\$\{EXTEN\}/);
          expect(dp).not.toMatch(/Goto\(\$\{EXTEN\}/);
        }
      }
      const ivr = AsteriskDialplanUtils.actionToDialplan(
        { type: 'toivr', params: { ivr_uid: 7 }, condition: {} },
        vpbx,
      );
      expect(ivr).toContain('GotoIf($[${__KRSK_HOPS} <= 10]?ivr_7,start,1)');
      expect(ivr).not.toContain('${EXTEN}');
    });

    it('totrunk numberManipulation strip then prepend', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        {
          type: 'totrunk',
          params: {
            trunk: 'PJSIP/out1',
            dest: { source: 'fixed', value: '79001234567' },
            timeout: 60,
            options: 'tT',
            numberManipulation: { strip: 1, prepend: '8' },
          },
          condition: {},
        },
        vpbx,
      );
      expect(dp).toBe('Dial(PJSIP/out1/89001234567,60,tT)');
    });

    it('multiline + time group never produces ?same =>', () => {
      AsteriskDialplanUtils.backendBaseUrl = 'http://backend.test/api';
      AsteriskDialplanUtils.dialplanApiKey = 'wave0-key';
      const dp = renderActionChain(
        [{
          type: 'notify',
          params: {
            channels: ['email'],
            recipients: { email: 'ops@example.com' },
            subject: 's',
            body: 't',
          },
          condition: { time_group_uid: 12 },
        }],
        { vpbxUserUid: vpbx, host: 'route' },
      );
      expect(dp).not.toContain('?same =>');
      for (const line of dp.split('\n').filter(Boolean)) {
        expect(line === dp.split('\n')[0] || line.startsWith('same =>')).toBe(true);
      }
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

describe('D-25 hop prologue on toroute / toivr', () => {
  const vpbx = 42;

  it('toroute emits Set(__KRSK_HOPS and guard in the same branch', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      { type: 'toroute', params: { context: 'sip-out', extension: '100' }, condition: {} },
      vpbx,
    );
    expect(dp).toContain('Set(__KRSK_HOPS=');
    expect(dp).toContain('GotoIf($[');
    expect(dp).toContain('sip-out42,100,1');
    expect(dp).toContain('Congestion()');
    expect(dp).toContain('NoOp(');
    expect(dp.indexOf('Set(__KRSK_HOPS=')).toBeLessThan(dp.indexOf('GotoIf'));
  });

  it('toivr emits the same hop prologue around Goto(ivr_...)', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      { type: 'toivr', params: { ivr_uid: 7 }, condition: {} },
      vpbx,
    );
    expect(dp).toContain('Set(__KRSK_HOPS=');
    expect(dp).toContain('GotoIf($[');
    expect(dp).toContain('ivr_7,start,1');
    expect(dp).toContain('Congestion()');
  });
});

describe('D-53 findUnreachableSteps / digit-exit', () => {
  const playback = { type: 'playback', params: { file: 'welcome' }, condition: {} };
  const hangup = { type: 'hangup', params: {}, condition: {} };
  const setvar = { type: 'setvar', params: {}, condition: {} };
  const wait = { type: 'wait', params: {}, condition: {} };
  const playbackWithDigitExit = { type: 'playback', params: { file: 'menu', mode: 'menu', digitExit: true, digit: '1', digitExitDest: 'ivr_7,start,1' }, condition: {} };

  it('marks steps after an always-terminal hangup as unreachable', () => {
    expect(findUnreachableSteps([playback, hangup, setvar, wait])).toEqual([2, 3]);
  });

  it('does not treat a conditional terminal (digit-exit playback) as cutting the tail', () => {
    expect(findUnreachableSteps([playbackWithDigitExit, setvar])).toEqual([]);
  });

  it('does not false-positive on empty chain or a single terminal step', () => {
    expect(findUnreachableSteps([])).toEqual([]);
    expect(findUnreachableSteps([hangup])).toEqual([]);
  });

  it('digit-exit emits a conditional transfer, not an unconditional Goto to the same dest', () => {
    const dest = 'ivr_7,start,1';
    const out = emitDigitExitTransition('1', dest);
    expect(out).toContain('GotoIf($[');
    expect(out).toContain(dest);
    expect(out).not.toContain(`Goto(${dest})`);

    const dp = AsteriskDialplanUtils.actionToDialplan(playbackWithDigitExit, 42);
    expect(dp).toContain('GotoIf($[');
    expect(dp).toContain(dest);
    expect(dp).not.toContain(`Goto(${dest})`);
  });
});
