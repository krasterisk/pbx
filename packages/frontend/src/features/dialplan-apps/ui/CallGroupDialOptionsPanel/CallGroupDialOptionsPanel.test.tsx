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
    data: [{ uid: 5, exten: '600', name: 'Sales', dialOptions: 'tThH' }],
    isLoading: false,
  }),
}));

describe('CallGroupDialOptionsPanel', () => {
  it('shows read-only dial options for the selected group', () => {
    render(<CallGroupDialOptionsPanel groupRef="5" />);
    expect(screen.getByText(/карточке группы/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sales/i })).toHaveAttribute('href', '/call-groups?edit=5');
  });

  it('resolves a group by public number as well as uid', () => {
    render(<CallGroupDialOptionsPanel groupRef="600" />);
    expect(screen.getByRole('link', { name: /Sales/i })).toHaveAttribute('href', '/call-groups?edit=5');
  });

  it('asks to pick a group when uid is empty', () => {
    render(<CallGroupDialOptionsPanel groupRef="" />);
    expect(screen.getByText(/Сначала выберите группу/i)).toBeInTheDocument();
  });
});
