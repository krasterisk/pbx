import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CallGroupDialOptionsPanel } from './CallGroupDialOptionsPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@/shared/api/endpoints/callGroupApi', () => ({
  useGetCallGroupsQuery: () => ({
    data: [{ uid: 5, name: 'Sales', dialOptions: 'tThH' }],
    isLoading: false,
  }),
}));

describe('CallGroupDialOptionsPanel', () => {
  it('shows read-only dial options for the selected group', () => {
    render(<CallGroupDialOptionsPanel groupUid="5" />);
    expect(screen.getByText(/карточке группы/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sales/i })).toHaveAttribute('href', '/call-groups?edit=5');
  });

  it('asks to pick a group when uid is empty', () => {
    render(<CallGroupDialOptionsPanel groupUid="" />);
    expect(screen.getByText(/Сначала выберите группу/i)).toBeInTheDocument();
  });
});
