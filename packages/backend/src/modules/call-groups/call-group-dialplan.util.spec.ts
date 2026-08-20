import type { ICallGroup, ICallGroupMember } from '@krasterisk/shared';
import { generateGroupDialplan } from './call-group-dialplan.util';

const VPBX = 42;

function baseGroup(overrides: Partial<ICallGroup> = {}): ICallGroup {
  return {
    uid: 15,
    name: 'Sales dept',
    exten: '15',
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
      expect(result.lines.join('\n')).not.toContain('PJSIP/ew555_42');
      expect(result.lines.join('\n')).toContain('LOCAL/79990001122@ctx-out');
    });

    it('forks WebRTC companion when extension is in webrtcExtensions set', () => {
      const members: ICallGroupMember[] = [
        {
          uid: 1,
          call_group_uid: 15,
          member_type: 'internal',
          value: '110',
          position: 1,
          ring_time: 10,
          user_uid: VPBX,
        },
      ];
      const group = baseGroup({ strategy: 'ringall' });
      const result = generateGroupDialplan(group, members, VPBX, new Set(['110']));
      expect(result.lines.join('\n')).toContain('PJSIP/e110_42&PJSIP/ew110_42');
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

describe('generateGroupDialplan (Wave 0 exact toBe baselines)', () => {
  it('ringall full output is exact (D-33 context + D-34 tT)', () => {
    const result = generateGroupDialplan(baseGroup({ strategy: 'ringall' }), sampleMembers(), VPBX);
    expect(result.lines.join('\n')).toBe(
      [
        '[group_15_42]',
        'exten => start,1,NoOp(Call group: Sales dept [ringall])',
        'same => n,Dial(PJSIP/e101_42&PJSIP/e102_42&LOCAL/79001234567@ctx-42,25,tT)',
        'same => n,Return()',
      ].join('\n'),
    );
  });

  it('hunt full output is exact', () => {
    const result = generateGroupDialplan(baseGroup({ strategy: 'hunt' }), sampleMembers(), VPBX);
    expect(result.lines.join('\n')).toBe(
      [
        '[group_15_42]',
        'exten => start,1,NoOp(Call group: Sales dept [hunt])',
        'same => n,Dial(PJSIP/e101_42,20,tT)',
        'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
        'same => n,Dial(PJSIP/e102_42,15,tT)',
        'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
        'same => n,Dial(LOCAL/79001234567@ctx-42,30,tT)',
        'same => n,Return()',
      ].join('\n'),
    );
  });

  it('memoryhunt full output is exact', () => {
    const result = generateGroupDialplan(baseGroup({ strategy: 'memoryhunt' }), sampleMembers(), VPBX);
    expect(result.lines.join('\n')).toBe(
      [
        '[group_15_42]',
        'exten => start,1,NoOp(Call group: Sales dept [memoryhunt])',
        'same => n,Dial(PJSIP/e101_42,20,tT)',
        'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
        'same => n,Dial(PJSIP/e101_42&PJSIP/e102_42,15,tT)',
        'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
        'same => n,Dial(PJSIP/e101_42&PJSIP/e102_42&LOCAL/79001234567@ctx-42,30,tT)',
        'same => n,Return()',
      ].join('\n'),
    );
  });

  it('random full output is exact', () => {
    const result = generateGroupDialplan(baseGroup({ strategy: 'random' }), sampleMembers(), VPBX);
    expect(result.lines.join('\n')).toBe(
      [
        '[group_15_42]',
        'exten => start,1,NoOp(Call group: Sales dept [random])',
        'same => n,Set(GRP_PICK=${RAND(1,3)})',
        'same => n,GotoIf($["${GRP_PICK}" = "1"]?m1)',
        'same => n,GotoIf($["${GRP_PICK}" = "2"]?m2)',
        'same => n,Goto(m3)',
        'same => n(m1),Dial(PJSIP/e101_42,20,tT)',
        'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
        'same => n,Dial(PJSIP/e102_42&LOCAL/79001234567@ctx-42,25,tT)',
        'same => n,Return()',
        'same => n(m2),Dial(PJSIP/e102_42,15,tT)',
        'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
        'same => n,Dial(PJSIP/e101_42&LOCAL/79001234567@ctx-42,25,tT)',
        'same => n,Return()',
        'same => n(m3),Dial(LOCAL/79001234567@ctx-42,30,tT)',
        'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
        'same => n,Dial(PJSIP/e101_42&PJSIP/e102_42,25,tT)',
        'same => n,Return()',
      ].join('\n'),
    );
  });

  it('CALLERID(name) after cid_prefix is not restored after Return() (D-35 baseline)', () => {
    const result = generateGroupDialplan(
      baseGroup({ strategy: 'ringall', cid_prefix: 'Sales' }),
      sampleMembers(),
      VPBX,
    );
    const joined = result.lines.join('\n');
    const returnIndex = joined.lastIndexOf('same => n,Return()');
    expect(joined.slice(returnIndex)).toBe('same => n,Return()');
    expect(joined).toContain('same => n,Set(CALLERID(name)=Sales ${CALLERID(name)})');
  });

  it('random with five members emits 10 Dial() blocks (D-35 baseline)', () => {
    const five: ICallGroupMember[] = [1, 2, 3, 4, 5].map((i) => ({
      uid: i,
      call_group_uid: 15,
      member_type: 'internal' as const,
      value: String(100 + i),
      position: i,
      ring_time: 15,
      user_uid: VPBX,
    }));
    const result = generateGroupDialplan(baseGroup({ strategy: 'random' }), five, VPBX);
    expect(result.lines.join('\n').split('Dial(').length - 1).toBe(10);
    expect(result.name).toBe('group_15_42');
  });
});

describe('generateGroupDialplan (D-33 unified context + transitional include)', () => {
  it('names the context group_{exten}_{uid} for exten 600 and tenant 42', () => {
    const result = generateGroupDialplan(baseGroup({ exten: '600' }), sampleMembers(), VPBX);
    expect(result.name).toBe('group_600_42');
    expect(result.lines[0]).toBe('[group_600_42]');
  });

  it('emits include => of the old group_{uid}_{vpbx} name', () => {
    const result = generateGroupDialplan(baseGroup({ exten: '600' }), sampleMembers(), VPBX);
    expect(result.lines).toContain('include => group_15_42');
  });

  it('does not self-include when the new name equals the old name', () => {
    const result = generateGroupDialplan(baseGroup({ exten: '15' }), sampleMembers(), VPBX);
    const includes = result.lines.filter((l) => l.startsWith('include =>'));
    expect(includes).toEqual([]);
  });

  it('accepts dialOpts and keeps default tT when omitted', () => {
    const custom = generateGroupDialplan(
      baseGroup({ strategy: 'ringall', exten: '600' }),
      sampleMembers(),
      VPBX,
      undefined,
      { dialOpts: 't' },
    );
    expect(custom.lines.join('\n')).toMatch(/,t\)$/m);
    expect(custom.lines.join('\n')).not.toContain(',tT)');
  });

  it.each(['ringall', 'hunt', 'memoryhunt'] as const)(
    '%s body matches 12-01 baseline after substituting the new context name',
    (strategy) => {
      const result = generateGroupDialplan(baseGroup({ strategy, exten: '600' }), sampleMembers(), VPBX);
      const body = result.lines
        .filter((l) => !l.startsWith('[') && !l.startsWith('include =>'))
        .join('\n');
      const baseline = generateGroupDialplan(baseGroup({ strategy, exten: '15' }), sampleMembers(), VPBX);
      const baselineBody = baseline.lines
        .filter((l) => !l.startsWith('[') && !l.startsWith('include =>'))
        .join('\n');
      expect(body).toBe(baselineBody);
    },
  );
});
