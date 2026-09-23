import { compileSetupBrief, normalizeClock, normalizeDays, type SetupBrief } from './setup-brief';

function ivrBrief(patch: Partial<SetupBrief['slots']> = {}): SetupBrief {
  return {
    domain: 'ivr',
    missing: [],
    slots: {
      name: 'Рога и копыта',
      greeting: 'Здравствуйте',
      digits: {
        '1': { kind: 'extension', target: '101' },
        '2': { kind: 'extension', target: '102' },
        '3': { kind: 'extension', target: '103' },
      },
      timeout: { kind: 'group' },
      ...patch,
    },
  };
}

function routeBrief(days: string, timeStart: string): SetupBrief {
  return {
    domain: 'route',
    missing: [],
    slots: {
      did: '2236263',
      contextUid: 2,
      ivrUid: 22,
      calendar: { name: 'Рабочие', timeStart, timeEnd: '17:00', days },
    },
  };
}

describe('compileSetupBrief', () => {
  it('builds the same IVR steps from equivalent slot spellings', () => {
    const plain = compileSetupBrief(ivrBrief());
    const spaced = compileSetupBrief(ivrBrief({
      greeting: '  Здравствуйте  ',
      digits: {
        '1': { kind: 'extension', target: ' 101 ' },
        '2': { kind: 'extension', target: '102' },
        '3': { kind: 'extension', target: '103' },
      },
    }));
    expect(plain.kind).toBe('plan');
    expect(spaced.kind).toBe('plan');
    if (plain.kind !== 'plan' || spaced.kind !== 'plan') return;
    expect(spaced.draft.steps).toEqual(plain.draft.steps);
    expect(plain.draft.steps.map((step) => step.tool)).toEqual([
      'create_endpoints_bulk',
      'create_call_group',
      'create_ivr',
    ]);
    const group = plain.draft.steps.find((step) => step.tool === 'create_call_group');
    expect(group?.args).toEqual(expect.objectContaining({ strategy: 'ringall' }));
    expect(group?.args.members).toEqual([
      { member_type: 'internal', value: '101', position: 0 },
      { member_type: 'internal', value: '102', position: 1 },
      { member_type: 'internal', value: '103', position: 2 },
    ]);
  });

  it('builds the same route-and-calendar steps from weekday paraphrases', () => {
    const weekday = compileSetupBrief(routeBrief('mon-fri', '08:00'));
    const budni = compileSetupBrief(routeBrief('будни', '8:00'));
    expect(weekday.kind).toBe('plan');
    expect(budni.kind).toBe('plan');
    if (weekday.kind !== 'plan' || budni.kind !== 'plan') return;
    expect(budni.draft.steps).toEqual(weekday.draft.steps);
    expect(weekday.draft.steps.map((step) => step.tool)).toEqual(['create_time_group', 'create_route']);
    expect(weekday.draft.steps.some((step) => step.tool === 'create_ivr')).toBe(false);
    const route = weekday.draft.steps.find((step) => step.tool === 'create_route');
    expect(route?.args).toEqual(expect.objectContaining({
      context_uid: 2,
      extensions: ['2236263'],
    }));
    const action = (route?.args.actions as Array<Record<string, unknown>>)[0];
    expect(action).toEqual(expect.objectContaining({
      type: 'toivr',
      params: { ivr_uid: 22 },
      condition: { time_group_uid: 'steps.tg.result.uid' },
    }));
  });

  it('asks for one missing slot instead of a card', () => {
    const result = compileSetupBrief({
      domain: 'route',
      missing: [],
      slots: { did: '2236263', calendar: { name: 'Рабочие', timeStart: '08:00', timeEnd: '17:00', days: 'mon-fri' } },
    });
    expect(result.kind).toBe('clarify');
  });

  it('normalizes clocks and weekdays', () => {
    expect(normalizeClock('8:00')).toBe('08:00');
    expect(normalizeDays('будни')).toBe('mon-fri');
    expect(normalizeDays('пн-пт')).toBe('mon-fri');
  });
});
