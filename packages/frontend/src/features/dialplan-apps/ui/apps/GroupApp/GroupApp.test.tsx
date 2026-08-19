import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GroupApp } from './GroupApp';
import * as callGroupApiHooks from '@/shared/api/endpoints/callGroupApi';

const mockDispatch = vi.fn();
const mockOnChange = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => false,
}));

vi.mock('@/shared/api/endpoints/callGroupApi', () => ({
  useGetCallGroupsQuery: vi.fn(),
}));

vi.mock('@/features/call-groups', () => ({
  CallGroupFormModal: ({ onSaved }: { onSaved?: (g: { uid: number }) => void }) => (
    <div data-testid="call-group-form-modal">
      <button
        type="button"
        data-testid="simulate-saved"
        onClick={() => onSaved?.({ uid: 99 })}
      >
        simulate-saved
      </button>
    </div>
  ),
  callGroupsPageActions: {
    openCreateModal: () => ({ type: 'callGroupsPage/openCreateModal' }),
    openEditModal: (uid: number) => ({ type: 'callGroupsPage/openEditModal', payload: uid }),
  },
}));

const baseParams = { group: '', extra: 'keep-me' };

describe('GroupApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (callGroupApiHooks.useGetCallGroupsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { uid: 7, name: 'Sales', strategy: 'ringall', members: [] },
        { uid: 12, name: 'Support', strategy: 'hunt', members: [] },
      ],
    });
  });

  it('renders group options and patches only the changed field', () => {
    let params = { ...baseParams };
    const onChange = vi.fn((patch: Record<string, unknown>) => {
      params = { ...params, ...patch };
    });
    render(<GroupApp params={params} onChange={onChange} />);

    const select = screen.getByLabelText('Select call group') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', '7', '12']);

    fireEvent.change(select, { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith({ group: '12' });
    expect(params).toEqual({ group: '12', extra: 'keep-me' });
  });

  it('opens CallGroupFormModal create flow when no group is selected', () => {
    render(<GroupApp params={baseParams} onChange={mockOnChange} />);

    expect(screen.getByTestId('call-group-form-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create group'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'callGroupsPage/openCreateModal' });
  });

  it('opens edit modal when a group is selected and refreshes uid after save', () => {
    render(<GroupApp params={{ group: '7' }} onChange={mockOnChange} />);

    fireEvent.click(screen.getByText('Edit group'));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'callGroupsPage/openEditModal',
      payload: 7,
    });

    fireEvent.click(screen.getByTestId('simulate-saved'));
    expect(mockOnChange).toHaveBeenCalledWith({ group: '99' });
  });
});
