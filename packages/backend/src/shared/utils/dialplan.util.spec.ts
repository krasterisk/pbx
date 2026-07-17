import { AsteriskDialplanUtils } from './dialplan.util';

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
});
