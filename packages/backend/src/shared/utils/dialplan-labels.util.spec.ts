import { collectLabels, validateLabelRefs } from './dialplan-labels.util';

function label(id: string, name: string) {
  return { id, type: 'label', params: { label_name: name }, condition: {} };
}

function goto(id: string, name: string) {
  return { id, type: 'goto', params: { label_name: name }, condition: {} };
}

function conditionalGoto(id: string, thenLabel: string, elseLabel: string) {
  return {
    id,
    type: 'goto',
    params: {
      label_name: thenLabel,
      false_label: elseLabel,
      condition: { source: 'dialstatus', values: ['ANSWER'] },
    },
    condition: {},
  };
}

describe('collectLabels (D-44)', () => {
  it('maps start and end to their step indices', () => {
    const actions = [
      label('l1', 'start'),
      { id: 'p1', type: 'playback', params: { file: 'welcome' }, condition: {} },
      label('l2', 'end'),
    ];
    expect(collectLabels(actions)).toEqual(new Map([
      ['start', 0],
      ['end', 2],
    ]));
  });
});

describe('validateLabelRefs (D-44)', () => {
  it('rejects a goto to a missing label and names the step and label', () => {
    const errors = validateLabelRefs([goto('g1', 'nope')]);
    expect(errors).toHaveLength(1);
    expect(errors[0].actionId).toBe('g1');
    expect(errors[0].message).toMatch(/nope/);
  });

  it('rejects two labels with the same name in one chain', () => {
    const errors = validateLabelRefs([
      label('l1', 'start'),
      label('l2', 'start'),
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/start/i);
    expect(errors[0].message).toMatch(/дубл|duplicate/i);
  });

  it('rejects a conditional goto whose else-label is missing', () => {
    const errors = validateLabelRefs([
      label('l1', 'ok'),
      conditionalGoto('b1', 'ok', 'missing'),
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.actionId === 'b1' && /missing/.test(e.message))).toBe(true);
  });

  it('accepts plain and conditional gotos that point at existing labels', () => {
    const errors = validateLabelRefs([
      label('l1', 'start'),
      conditionalGoto('b1', 'start', 'end'),
      goto('g1', 'end'),
      label('l2', 'end'),
    ]);
    expect(errors).toEqual([]);
  });
});
