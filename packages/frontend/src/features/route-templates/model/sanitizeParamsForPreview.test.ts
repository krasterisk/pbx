import { describe, expect, it } from 'vitest';
import { templateSlotMarker, type ITemplateSlot } from '@krasterisk/shared';
import { sanitizeParamsForPreview } from './sanitizeParamsForPreview';

const queueSlot: ITemplateSlot = {
  id: 'queue-a_1778039515670_snrw-target.value',
  kind: 'queue',
  label: '700',
};

describe('sanitizeParamsForPreview', () => {
  it('replaces nested and array markers with labels without mutating input', () => {
    const marker = templateSlotMarker(queueSlot.id);
    const trunkMarker = templateSlotMarker('trunk-1');
    const input = {
      target: { source: 'fixed', value: marker },
      trunks: [{ trunk: trunkMarker }],
      keep: 'sales',
    };

    const next = sanitizeParamsForPreview(input, [
      queueSlot,
      { id: 'trunk-1', kind: 'trunk', label: 'mgts' },
    ]);

    expect(next.target.value).toBe('700');
    expect(next.trunks[0].trunk).toBe('mgts');
    expect(next.keep).toBe('sales');
    expect(input.target.value).toBe(marker);
    expect(input.trunks[0].trunk).toBe(trunkMarker);
  });

  it('normalizes a legacy tenant queue label for preview', () => {
    const next = sanitizeParamsForPreview(
      { target: { source: 'fixed', value: templateSlotMarker(queueSlot.id) } },
      [{ ...queueSlot, label: 'q700_0' }],
    );
    expect(next.target.value).toBe('700');
  });

  it('falls back to the slot id when the label is missing', () => {
    const id = 'ivr-1';
    const next = sanitizeParamsForPreview(
      { ivr_uid: templateSlotMarker(id) },
      [{ id, kind: 'ivr', label: '   ' }],
    );
    expect(next.ivr_uid).toBe(id);
  });
});
