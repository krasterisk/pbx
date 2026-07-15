import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GroupApp } from './GroupApp';
import * as callGroupApiHooks from '@/shared/api/endpoints/callGroupApi';
import type { IRouteAction } from '@krasterisk/shared';

const mockDispatch = vi.fn();
const mockOnUpdate = vi.fn();

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

const baseAction: IRouteAction = {
  id: 'action-1',
  type: 'togroup',
  params: { group: '' },
  condition: {},
};

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

  it('renders group options and calls onUpdate with string uid on selection', () => {
    render(<GroupApp action={baseAction} onUpdate={mockOnUpdate} />);

    const select = screen.getByLabelText('Select call group') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(['', '7', '12']);

    fireEvent.change(select, { target: { value: '12' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-1', 'params.group', '12');
    expect(typeof mockOnUpdate.mock.calls[0][2]).toBe('string');
  });

  it('opens CallGroupFormModal create flow when no group is selected', () => {
    render(<GroupApp action={baseAction} onUpdate={mockOnUpdate} />);

    expect(screen.getByTestId('call-group-form-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create group'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'callGroupsPage/openCreateModal' });
  });

  it('opens edit modal when a group is selected and refreshes uid after save', () => {
    render(
      <GroupApp
        action={{ ...baseAction, params: { group: '7' } }}
        onUpdate={mockOnUpdate}
      />,
    );

    fireEvent.click(screen.getByText('Edit group'));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'callGroupsPage/openEditModal',
      payload: 7,
    });

    fireEvent.click(screen.getByTestId('simulate-saved'));
    expect(mockOnUpdate).toHaveBeenCalledWith('action-1', 'params.group', '99');
  });
});
