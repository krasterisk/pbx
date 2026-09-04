import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  TEMPLATE_SLOT_MARKER_RE,
  templateSlotMarker,
  type IRouteAction,
  type ITemplateSlot,
} from '@krasterisk/shared';
import { TemplateActionPreview } from './TemplateActionPreview';
import styles from './TemplateActionPreview.module.scss';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const SLOT_ID = 'queue-a_1778039515670_snrw-target.value';

function action(partial: Partial<IRouteAction> & Pick<IRouteAction, 'id' | 'type'>): IRouteAction {
  return { params: {}, condition: {}, ...partial };
}

function expectNoMarkerLeak(marker: string) {
  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(TEMPLATE_SLOT_MARKER_RE);
  expect(text).not.toContain(marker);
}

describe('TemplateActionPreview', () => {
  it('shows a human toqueue title and a 700 chip instead of a raw slot marker', () => {
    const marker = templateSlotMarker(SLOT_ID);
    const slots: ITemplateSlot[] = [{ id: SLOT_ID, kind: 'queue', label: '700' }];

    render(
      <TemplateActionPreview
        actions={[
          action({
            id: 'q1',
            type: 'toqueue',
            params: { target: { source: 'fixed', value: marker } },
          }),
        ]}
        slots={slots}
      />,
    );

    expectNoMarkerLeak(marker);
    expect(screen.getByText('Очередь 700')).toBeInTheDocument();
    const chip = document.querySelector(`.${styles.chip}`);
    expect(chip).toHaveTextContent('700');
  });

  it('sanitizes slotted toivr and togroup summaries', () => {
    const ivrMarker = templateSlotMarker('ivr-1');
    const groupMarker = templateSlotMarker('group-1');

    render(
      <TemplateActionPreview
        actions={[
          action({ id: 'i1', type: 'toivr', params: { ivr_uid: ivrMarker } }),
          action({ id: 'g1', type: 'togroup', params: { group: groupMarker } }),
        ]}
        slots={[
          { id: 'ivr-1', kind: 'ivr', label: 'Main IVR' },
          { id: 'group-1', kind: 'group', label: '12' },
        ]}
      />,
    );

    expectNoMarkerLeak(ivrMarker);
    expect(document.body.textContent ?? '').not.toContain(groupMarker);
    expect(screen.getByText('IVR #Main IVR')).toBeInTheDocument();
    expect(screen.getByText('Группа #12')).toBeInTheDocument();
    expect(screen.getByText('Main IVR')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
