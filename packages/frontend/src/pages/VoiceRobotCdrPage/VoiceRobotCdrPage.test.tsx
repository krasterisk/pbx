import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@/shared/api/endpoints/voiceRobotCdrApi', () => ({
  useGetVoiceRobotCdrsQuery: () => ({ data: { rows: [], count: 0 }, isLoading: false, isFetching: false }),
  useGetVoiceRobotCdrStatsQuery: () => ({ data: undefined, isLoading: false }),
  useLazyExportVoiceRobotCdrQuery: () => [vi.fn(), { isFetching: false }],
}));

vi.mock('@/features/voiceRobotCdr', () => ({
  VoiceRobotCdrFilter: () => <div data-testid="vr-cdr-filter-stub">filter</div>,
  VoiceRobotCdrTable: () => <div data-testid="vr-cdr-table-stub">table</div>,
  VoiceRobotCdrStats: () => <div data-testid="vr-cdr-stats-stub">stats</div>,
  VoiceRobotCdrDetailModal: () => null,
}));

import VoiceRobotCdrPage from './VoiceRobotCdrPage';

describe('VoiceRobotCdrPage hybrid overflow (D-29 / D-27 wave E)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<VoiceRobotCdrPage />);
    expect(screen.getByTestId('voice-robot-cdr-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('vr-cdr-table-stub')).toBeInTheDocument();
  });
});
