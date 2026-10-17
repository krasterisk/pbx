import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom';
import { CcMetricLabel } from './CcMetricLabel';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
describe('KPI explanations', () => {
  it('opens the formula and scope from the keyboard, without nesting buttons', async () => {
    const instance = i18next.createInstance(); await instance.init({ lng: 'en', resources: { en: { translation: {} } }, interpolation: { escapeValue: false } });
    render(<I18nextProvider i18n={instance}><CcMetricLabel metric="slaPct" period="Today" sample={12}>SLA</CcMetricLabel></I18nextProvider>);
    const label = screen.getByText('SLA'); expect(label).toHaveAttribute('tabindex', '0');
    fireEvent.focus(label);
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Today'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('12');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
