import type { ICallGroup, ICallGroupMember } from '@krasterisk/shared';
import { generateGroupDialplan } from './call-group-dialplan.util';

const VPBX = 42;

function baseGroup(overrides: Partial<ICallGroup> = {}): ICallGroup {
  return {
    uid: 15,
    name: 'Sales dept',
    strategy: 'ringall',
    ring_time: 25,
    external_context: 'ctx-42',
    user_uid: VPBX,
    ...overrides,
  };
}

function sampleMembers(): ICallGroupMember[] {
  return [
    {
      uid: 1,
      call_group_uid: 15,
      member_type: 'internal',
      value: '101',
      position: 1,
      ring_time: 20,
      user_uid: VPBX,
    },
    {
      uid: 2,
      call_group_uid: 15,
      member_type: 'internal',
      value: '102',
      position: 2,
      ring_time: 15,
      user_uid: VPBX,
    },
    {
      uid: 3,
      call_group_uid: 15,
      member_type: 'external',
      value: '79001234567',
      position: 3,
      ring_time: 30,
      user_uid: VPBX,
    },
  ];
}

function memberInterface(member: ICallGroupMember, vpbx: number, externalContext: string): string {
  if (member.member_type === 'internal') {
    return `PJSIP/e${member.value}_${vpbx}`;
  }
  return `LOCAL/${member.value}@${externalContext}`;
}

function assertNeverHangupAlwaysReturn(lines: string[]): void {
  const joined = lines.join('\n');
  expect(joined).not.toMatch(/Hangup/i);
  expect(lines[lines.length - 1]).toBe('same => n,Return()');
}

describe('generateGroupDialplan', () => {
  describe('category naming', () => {
    it('returns group_<uid>_<vpbx> as category name and header', () => {
      const result = generateGroupDialplan(baseGroup(), sampleMembers(), VPBX);
      expect(result.name).toBe('group_15_42');
      expect(result.lines[0]).toBe('[group_15_42]');
    });
  });

  describe('ringall strategy', () => {
    it('emits one simultaneous Dial with group ring_time then Return', () => {
      const members = sampleMembers();
      const group = baseGroup({ strategy: 'ringall', ring_time: 25 });
      const result = generateGroupDialplan(group, members, VPBX);

      const targets = members
        .map((m) => memberInterface(m, VPBX, group.external_context))
        .join('&');

      expect(result.lines).toContain(`exten => start,1,NoOp(Call group: ${group.name} [ringall])`);
      expect(result.lines).toContain(`same => n,Dial(${targets},25,tT)`);
      assertNeverHangupAlwaysReturn(result.lines);
    });
  });

  describe('hunt strategy', () => {
    it('emits per-member Dial steps with per-member ring_time and ANSWER-Return checks', () => {
      const members = sampleMembers();
      const group = baseGroup({ strategy: 'hunt' });
      const result = generateGroupDialplan(group, members, VPBX);

      expect(result.lines).toContain(`exten => start,1,NoOp(Call group: ${group.name} [hunt])`);
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[0], VPBX, group.external_context)},20,tT)`,
      );
      expect(result.lines).toContain('same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())');
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[1], VPBX, group.external_context)},15,tT)`,
      );
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[2], VPBX, group.external_context)},30,tT)`,
      );
      assertNeverHangupAlwaysReturn(result.lines);
    });
  });

  describe('memoryhunt strategy', () => {
    it('emits growing Dial sets with per-step ring_time and ANSWER-Return checks', () => {
      const members = sampleMembers();
      const group = baseGroup({ strategy: 'memoryhunt' });
      const result = generateGroupDialplan(group, members, VPBX);

      expect(result.lines).toContain(`exten => start,1,NoOp(Call group: ${group.name} [memoryhunt])`);
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[0], VPBX, group.external_context)},20,tT)`,
      );
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[0], VPBX, group.external_context)}&${memberInterface(members[1], VPBX, group.external_context)},15,tT)`,
      );
      expect(result.lines).toContain(
        `same => n,Dial(${members.map((m) => memberInterface(m, VPBX, group.external_context)).join('&')},30,tT)`,
      );
      expect(result.lines.filter((l) => l === 'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())').length).toBe(2);
      assertNeverHangupAlwaysReturn(result.lines);
    });
  });

  describe('random strategy', () => {
    it('emits RAND pick, GotoIf branches, and per-branch hunt of remaining members', () => {
      const members = sampleMembers();
      const group = baseGroup({ strategy: 'random' });
      const result = generateGroupDialplan(group, members, VPBX);

      expect(result.lines).toContain(`exten => start,1,NoOp(Call group: ${group.name} [random])`);
      expect(result.lines).toContain('same => n,Set(GRP_PICK=${RAND(1,3)})');
      expect(result.lines).toContain('same => n,GotoIf($["${GRP_PICK}" = "1"]?m1)');
      expect(result.lines).toContain('same => n,GotoIf($["${GRP_PICK}" = "2"]?m2)');
      expect(result.lines).toContain('same => n,Goto(m3)');
      expect(result.lines).toContain(`same => n(m1),Dial(${memberInterface(members[0], VPBX, group.external_context)},20,tT)`);
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[1], VPBX, group.external_context)}&${memberInterface(members[2], VPBX, group.external_context)},25,tT)`,
      );
      expect(result.lines).toContain(`same => n(m2),Dial(${memberInterface(members[1], VPBX, group.external_context)},15,tT)`);
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[0], VPBX, group.external_context)}&${memberInterface(members[2], VPBX, group.external_context)},25,tT)`,
      );
      expect(result.lines).toContain(`same => n(m3),Dial(${memberInterface(members[2], VPBX, group.external_context)},30,tT)`);
      expect(result.lines).toContain(
        `same => n,Dial(${memberInterface(members[0], VPBX, group.external_context)}&${memberInterface(members[1], VPBX, group.external_context)},25,tT)`,
      );
      assertNeverHangupAlwaysReturn(result.lines);
    });
  });

  describe('member rendering', () => {
    it('renders internal members as PJSIP/e<ext>_<vpbx> and external as LOCAL/<num>@<ctx>', () => {
      const members: ICallGroupMember[] = [
        {
          uid: 1,
          call_group_uid: 15,
          member_type: 'internal',
          value: '555',
          position: 1,
          ring_time: 10,
          user_uid: VPBX,
        },
        {
          uid: 2,
          call_group_uid: 15,
          member_type: 'external',
          value: '79990001122',
          position: 2,
          ring_time: 10,
          user_uid: VPBX,
        },
      ];
      const group = baseGroup({ strategy: 'hunt', external_context: 'ctx-out' });
      const result = generateGroupDialplan(group, members, VPBX);

      expect(result.lines.join('\n')).toContain('PJSIP/e555_42');
      expect(result.lines.join('\n')).toContain('LOCAL/79990001122@ctx-out');
    });

    it('sorts members by position regardless of input order', () => {
      const members: ICallGroupMember[] = [
        {
          uid: 2,
          call_group_uid: 15,
          member_type: 'internal',
          value: '202',
          position: 2,
          ring_time: 12,
          user_uid: VPBX,
        },
        {
          uid: 1,
          call_group_uid: 15,
          member_type: 'internal',
          value: '101',
          position: 1,
          ring_time: 11,
          user_uid: VPBX,
        },
      ];
      const group = baseGroup({ strategy: 'hunt' });
      const result = generateGroupDialplan(group, members, VPBX);

      const dialLines = result.lines.filter((l) => l.startsWith('same => n,Dial('));
      expect(dialLines[0]).toContain('PJSIP/e101_42');
      expect(dialLines[1]).toContain('PJSIP/e202_42');
    });
  });

  describe('cid_prefix (D-09)', () => {
    it('emits CALLERID(name) prefix before Dial when cid_prefix is set', () => {
      const group = baseGroup({ strategy: 'ringall', cid_prefix: 'Sales' });
      const result = generateGroupDialplan(group, sampleMembers(), VPBX);

      const dialIndex = result.lines.findIndex((l) => l.startsWith('same => n,Dial('));
      expect(dialIndex).toBeGreaterThan(1);
      expect(result.lines[dialIndex - 1]).toBe('same => n,Set(CALLERID(name)=Sales ${CALLERID(name)})');
    });
  });

  describe('sanitization', () => {
    it('strips dialplan metacharacters from member values', () => {
      const members: ICallGroupMember[] = [
        {
          uid: 1,
          call_group_uid: 15,
          member_type: 'internal',
          value: '10;1$()',
          position: 1,
          ring_time: 10,
          user_uid: VPBX,
        },
      ];
      const group = baseGroup({ strategy: 'hunt' });
      const result = generateGroupDialplan(group, members, VPBX);

      expect(result.lines.join('\n')).toContain('PJSIP/e101_42');
      expect(result.lines.join('\n')).not.toContain('10;1$()');
    });
  });

  describe('Return semantics (never Hangup)', () => {
    const strategies = ['ringall', 'hunt', 'memoryhunt', 'random'] as const;

    it.each(strategies)('%s output never contains Hangup and ends with Return()', (strategy) => {
      const result = generateGroupDialplan(baseGroup({ strategy }), sampleMembers(), VPBX);
      assertNeverHangupAlwaysReturn(result.lines);
    });
  });
});
