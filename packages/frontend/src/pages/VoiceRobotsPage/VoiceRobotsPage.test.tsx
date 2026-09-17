import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const navigate = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@/features/voiceRobots/ui/VoiceRobotsTable', () => ({
  VoiceRobotsTable: () => <div data-testid="voice-robots-table-stub">robots</div>,
}));

import VoiceRobotsPage from './VoiceRobotsPage';

describe('VoiceRobotsPage', () => {
  it('renders title, subtitle, create CTA and table', () => {
    render(<VoiceRobotsPage />);

    expect(screen.getByTestId('voice-robots-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'voiceRobots.title' })).toBeInTheDocument();
    expect(screen.getByText('voiceRobots.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voiceRobots.create/i })).toBeInTheDocument();
    expect(screen.getByTestId('voice-robots-table-stub')).toBeInTheDocument();
  });

  it('navigates to create from the page CTA', async () => {
    const user = userEvent.setup();
    render(<VoiceRobotsPage />);

    await user.click(screen.getByRole('button', { name: /voiceRobots.create/i }));
    expect(navigate).toHaveBeenCalledWith('/voice-robots/create');
  });
});
