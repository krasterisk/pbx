import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSchemaRefs } from './useSchemaRefs';
import * as directoryApi from '@/shared/api/endpoints/directoryApi';
import * as trunkApi from '@/shared/api/endpoints/trunkApi';

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/callGroupApi', () => ({
  useGetCallGroupsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/ivrsApi', () => ({
  useGetIvrsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/ttsEnginesApi', () => ({
  useGetTtsEnginesQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/voiceRobotsApi', () => ({
  useGetVoiceRobotsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/numberApi', () => ({
  useGetNumbersQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoriesQuery: vi.fn(),
}));

function Probe() {
  const refs = useSchemaRefs();
  const items = refs.dialplanDirectories?.items ?? [];
  return (
    <span data-testid="dirs">
      {items.map((item) => `${item.value}:${item.label}`).join(',')}
    </span>
  );
}

describe('useSchemaRefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (directoryApi.useGetDirectoriesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { uid: 7, name: 'Customers' },
        { uid: 8, name: 'VIP' },
      ],
      isLoading: false,
    });
  });

  it('owns the dialplanDirectories catalog query', () => {
    render(<Probe />);

    expect(directoryApi.useGetDirectoriesQuery).toHaveBeenCalled();
    expect(screen.getByTestId('dirs').textContent).toBe('7:Customers,8:VIP');
  });

  it('maps trunks by name and trunkIds by ITrunkListItem.id', () => {
    (trunkApi.useGetTrunksQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { id: 't_alpha_100', name: 'Alpha' },
        { id: 't_beta_100', name: 'Beta' },
      ],
      isLoading: false,
    });

    function TrunksProbe() {
      const refs = useSchemaRefs();
      return (
        <>
          <span data-testid="trunks">
            {(refs.trunks?.items ?? []).map((item) => `${item.value}:${item.label}`).join(',')}
          </span>
          <span data-testid="trunk-ids">
            {(refs.trunkIds?.items ?? []).map((item) => `${item.value}:${item.label}`).join(',')}
          </span>
        </>
      );
    }

    render(<TrunksProbe />);
    expect(screen.getByTestId('trunks').textContent).toBe('Alpha:Alpha,Beta:Beta');
    expect(screen.getByTestId('trunk-ids').textContent).toBe('t_alpha_100:Alpha,t_beta_100:Beta');
  });

  it('fetches trunks when only trunkIds is requested', () => {
    function IdsProbe() {
      useSchemaRefs(['trunkIds']);
      return null;
    }
    render(<IdsProbe />);
    expect(trunkApi.useGetTrunksQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: false }),
    );
  });
});
