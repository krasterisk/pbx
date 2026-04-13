import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { RolesTable } from './RolesTable';
import { rolesPageReducer } from '../../model/slice/rolesPageSlice';
import * as apiHooks from '@/shared/api/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/api/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useGetRolesQuery: vi.fn(),
    useDeleteRoleMutation: vi.fn(),
    useBulkDeleteRolesMutation: vi.fn(),
  };
});

const mockDispatch = vi.fn();
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(),
}));

const renderWithStore = (ui: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      rolesPage: rolesPageReducer,
    },
  });
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('RolesTable UI integration', () => {
  const mockRoles = [
    { id: 1, name: 'Admin', comment: 'Superuser' },
    { id: 2, name: 'Operator', comment: 'Call Center' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiHooks.useGetRolesQuery as any).mockReturnValue({ data: mockRoles, isLoading: false });
    (apiHooks.useDeleteRoleMutation as any).mockReturnValue([vi.fn()]);
    (apiHooks.useBulkDeleteRolesMutation as any).mockReturnValue([vi.fn(), { isLoading: false }]);
  });

  it('renders table rows', () => {
    renderWithStore(<RolesTable />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Superuser')).toBeInTheDocument();
  });

  it('dispatches openEditModal on edit button click', () => {
    renderWithStore(<RolesTable />);
    
    // Using title from mock translation: 'common.edit' translates to 'common.edit'
    const editBtns = screen.getAllByTitle('common.edit');
    fireEvent.click(editBtns[0]);
    
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rolesPage/openEditModal',
        payload: mockRoles[0],
      })
    );
  });
});
