import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/shared/api/endpoints/voiceRobotsApi', () => ({
  useGetVoiceRobotsQuery: () => ({ data: [], isLoading: false }),
  useDeleteVoiceRobotMutation: () => [vi.fn()],
}));

vi.mock('@/features/voiceRobots', () => ({
  voiceRobotsActions: {},
}));

vi.mock('@/features/voiceRobots/ui/VoiceRobotsTable/VoiceRobotsTable', () => ({
  VoiceRobotsTable: () => <div data-testid="voice-robots-table-stub">robots</div>,
}));

import VoiceRobotsPage from './VoiceRobotsPage';

describe('VoiceRobotsPage hybrid overflow (D-29 / D-27 wave C)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<VoiceRobotsPage />);
    expect(screen.getByTestId('voice-robots-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('voice-robots-table-stub')).toBeInTheDocument();
  });
});
