import { rtkApi } from '../rtkApi';

/** Catalog row for the route-step room picker. Full room type lands in Phase 16.3. */
interface ConferenceRoomCatalogItem {
  uid: number;
  number: string;
  name: string;
}

const conferenceRoomApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getConferenceRooms: build.query<ConferenceRoomCatalogItem[], void>({
      query: () => '/conferences',
      providesTags: ['ConferenceRooms'],
    }),
  }),
});

export const { useGetConferenceRoomsQuery } = conferenceRoomApi;
