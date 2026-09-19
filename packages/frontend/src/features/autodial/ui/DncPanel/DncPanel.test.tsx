import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DncPanel } from './DncPanel';

const mocks = vi.hoisted(() => ({
  entries: [
    { uid: 1, scope: 'global', scope_uid: null, normalized_phone: '70000000001' },
    { uid: 2, scope: 'base', scope_uid: 8, normalized_phone: '70000000002' },
    { uid: 3, scope: 'campaign', scope_uid: 11, normalized_phone: '70000000003' },
    { uid: 4, scope: 'campaign', scope_uid: 12, normalized_phone: '70000000004' },
  ],
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialDncQuery: () => ({ data: mocks.entries, isFetching: false }),
  useCreateAutodialDncMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteAutodialDncMutation: () => [vi.fn()],
}));

describe('DncPanel campaign boundary', () => {
  it('shows global and base entries as inherited but only allows deleting the current campaign scope', () => {
    render(
      <DncPanel
        scopedAs="campaign"
        scopeUid={11}
        inheritedScope={{ scope: 'base', uid: 8 }}
      />,
    );

    expect(screen.getByText('70000000001')).toBeInTheDocument();
    expect(screen.getByText('70000000002')).toBeInTheDocument();
    expect(screen.getByText('70000000003')).toBeInTheDocument();
    expect(screen.queryByText('70000000004')).not.toBeInTheDocument();
    expect(screen.getAllByText('autodial.dnc.inheritedReadOnly')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'common.delete' })).toHaveLength(1);
  });
});
