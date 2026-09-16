import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSchemaRefs } from './useSchemaRefs';
import * as directoryApi from '@/shared/api/endpoints/directoryApi';
import * as trunkApi from '@/shared/api/endpoints/trunkApi';

const { useGetConferenceRoomsQuery } = vi.hoisted(() => ({
  useGetConferenceRoomsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

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
vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGetConferenceRoomsQuery,
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

  it('maps conferenceRooms uid as a decimal string and number - name label', () => {
    useGetConferenceRoomsQuery.mockReturnValue({
      data: [{ uid: 77, number: '6007', name: 'Планёрка' }],
      isLoading: false,
    });

    function RoomsProbe() {
      const refs = useSchemaRefs(['conferenceRooms']);
      const item = refs.conferenceRooms?.items[0];
      return (
        <span data-testid="rooms">
          {JSON.stringify({
            value: item?.value,
            label: item?.label,
            valueType: typeof item?.value,
            href: refs.conferenceRooms?.sectionHref,
            loading: refs.conferenceRooms?.isLoading,
          })}
        </span>
      );
    }

    render(<RoomsProbe />);
    expect(JSON.parse(screen.getByTestId('rooms').textContent ?? '{}')).toEqual({
      value: '77',
      label: '6007 - Планёрка',
      valueType: 'string',
      href: '/conferences',
      loading: false,
    });
  });

  it('labels a nameless conference room with the number only', () => {
    useGetConferenceRoomsQuery.mockReturnValue({
      data: [{ uid: 77, number: '6007', name: '' }],
      isLoading: false,
    });

    function NamelessProbe() {
      const refs = useSchemaRefs(['conferenceRooms']);
      return <span data-testid="nameless">{refs.conferenceRooms?.items[0]?.label}</span>;
    }

    render(<NamelessProbe />);
    expect(screen.getByTestId('nameless').textContent).toBe('6007');
  });

  it('skips the conference rooms query when only queues are requested', () => {
    function QueuesProbe() {
      useSchemaRefs(['queues']);
      return null;
    }
    render(<QueuesProbe />);
    expect(useGetConferenceRoomsQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: true }),
    );
  });

  it('registers conferenceRooms in CATALOG_DEFAULTS with /conferences', () => {
    const src = readFileSync(resolve(__dirname, '../ui/SchemaFields/SchemaFields.tsx'), 'utf8');
    expect(src).toMatch(/conferenceRooms:\s*\{\s*href:\s*['"]\/conferences['"]/);
  });
});
