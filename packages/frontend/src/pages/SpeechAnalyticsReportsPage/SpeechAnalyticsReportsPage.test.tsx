import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeechAnalyticsReportsPage } from './SpeechAnalyticsReportsPage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('SpeechAnalyticsReportsPage', () => {
  it('renders reports heading', () => {
    render(<SpeechAnalyticsReportsPage />);
    expect(screen.getByTestId('speech-analytics-reports')).toBeInTheDocument();
  });
});
