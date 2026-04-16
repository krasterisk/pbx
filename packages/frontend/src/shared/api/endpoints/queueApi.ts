import { rtkApi } from '../rtkApi';
import { IQueue, IQueueFull } from '@/features/queues/model/types/queuesSchema';

const queueApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getQueues: build.query<IQueue[], void>({
      query: () => '/queues',
      providesTags: ['Queues'],
    }),
    getQueue: build.query<IQueueFull, string>({
      query: (name) => `/queues/${encodeURIComponent(name)}`,
      providesTags: (_r, _e, name) => [{ type: 'Queues', id: name }],
    }),
    createQueue: build.mutation<IQueueFull, any>({
      query: (body) => ({
        url: '/queues',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Queues'],
    }),
    updateQueue: build.mutation<IQueueFull, { name: string; data: any }>({
      query: ({ name, data }) => ({
        url: `/queues/${encodeURIComponent(name)}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Queues'],
    }),
    deleteQueue: build.mutation<void, string>({
      query: (name) => ({
        url: `/queues/${encodeURIComponent(name)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Queues'],
    }),
  }),
});

export const {
  useGetQueuesQuery,
  useGetQueueQuery,
  useLazyGetQueueQuery,
  useCreateQueueMutation,
  useUpdateQueueMutation,
  useDeleteQueueMutation,
} = queueApi;
