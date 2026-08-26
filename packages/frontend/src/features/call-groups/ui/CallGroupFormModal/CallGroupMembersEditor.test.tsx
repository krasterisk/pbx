import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CallGroupMembersEditor, type LocalCallGroupMember } from './CallGroupMembersEditor';
import * as endpointApi from '@/shared/api/endpoints/endpointApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/api/endpoints/endpointApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetEndpointsQuery: vi.fn(),
  };
});

const members: LocalCallGroupMember[] = [
  { id: 1, member_type: 'internal', value: '101', ring_time: '' },
  { id: 2, member_type: 'external', value: '79001234567', ring_time: '' },
];

describe('CallGroupMembersEditor DnD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (endpointApi.useGetEndpointsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: '1', extension: '101', callerid: 'Alice' }],
      isLoading: false,
    });
  });

  it('renders a drag handle for each member instead of up/down buttons', () => {
    render(
      <CallGroupMembersEditor
        members={members}
        setMembers={vi.fn()}
        strategy="ringall"
        externalContext="ctx-1"
        onExternalContextChange={vi.fn()}
        contexts={[{ uid: 1, name: 'ctx-1' }]}
      />,
    );

    expect(screen.getAllByLabelText(/Перетащите для изменения порядка/i)).toHaveLength(2);
    expect(screen.queryByTitle('Вверх')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Вниз')).not.toBeInTheDocument();
  });
});
