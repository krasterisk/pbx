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
  useParams: () => ({ id: 'create' }),
}));

vi.mock('@/shared/api/endpoints/voiceRobotsApi', () => ({
  useGetVoiceRobotQuery: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/features/voiceRobots/ui/VoiceRobotForm', () => ({
  VoiceRobotForm: () => <div data-testid="voice-robot-form-stub">form</div>,
}));

import VoiceRobotEditPage from './VoiceRobotEditPage';

describe('VoiceRobotEditPage phone stack (D-27 wave C)', () => {
  it('exposes edit-stack marker and contains form without page bleed class', () => {
    render(<VoiceRobotEditPage />);
    const page = screen.getByTestId('voice-robot-edit-responsive');
    expect(page).toBeInTheDocument();
    expect(page).toHaveAttribute('data-edit-stack', 'phone');
    expect(page.className).toMatch(/min-w-0|page/);
    expect(screen.getByTestId('voice-robot-form-stub')).toBeInTheDocument();
  });
});
