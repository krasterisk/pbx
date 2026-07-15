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
});
