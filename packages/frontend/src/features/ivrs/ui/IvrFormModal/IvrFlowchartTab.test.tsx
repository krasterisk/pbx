import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IvrFlowchartTab } from './IvrFlowchartTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-to-print', () => ({
  useReactToPrint: () => vi.fn(),
}));

const hangup = { id: 'h1', type: 'hangup' as const, params: {}, condition: {} };

describe('IvrFlowchartTab', () => {
  it('renders digit branches and human labels for t/i/max', () => {
    render(
      <IvrFlowchartTab
        name="Main"
        maxCount={3}
        timeout="10"
        menuItems={[
          { digit: '1', actions: [hangup] },
          { digit: '_XXX', actions: [hangup] },
          { digit: 't', actions: [hangup] },
          { digit: 'i', actions: [hangup] },
          { digit: 'max', actions: [hangup] },
        ]}
      />,
    );

    expect(screen.getByTestId('ivr-flowchart-tab')).toBeInTheDocument();
    expect(screen.getByTestId('flowchart-canvas')).toHaveAttribute('data-host', 'ivr');
    const edges = screen.getAllByTestId('flowchart-ivr-edge').map((el) => el.textContent);
    expect(edges).toContain('Кнопка 1');
    expect(edges).toContain('Набор по шаблону _XXX');
    expect(edges).toContain('Не нажали кнопку');
    expect(edges).toContain('Нажали неверную кнопку');
    expect(edges).toContain('Исчерпаны проходы по меню');
    expect(screen.queryByText(/direct.?dial/i)).toBeNull();
    expect(screen.queryByText(/напрямую/i)).toBeNull();
  });

  it('adds a max fallback node when max_count > 0 and no max item exists', () => {
    render(
      <IvrFlowchartTab
        name="Main"
        maxCount={2}
        menuItems={[{ digit: '1', actions: [hangup] }]}
      />,
    );

    expect(screen.getByTestId('flowchart-ivr-max-fallback')).toHaveTextContent(
      'Исчерпаны проходы по меню',
    );
  });

  it('does not invent t/i branches that are missing from the draft', () => {
    render(
      <IvrFlowchartTab
        name="Main"
        maxCount={0}
        menuItems={[{ digit: '2', actions: [hangup] }]}
      />,
    );

    expect(screen.queryByText('Не нажали кнопку')).toBeNull();
    expect(screen.queryByText('Нажали неверную кнопку')).toBeNull();
    expect(screen.queryByTestId('flowchart-ivr-max-fallback')).toBeNull();
  });
});
