import { rtkApi } from '../rtkApi';
import type { INotificationIntegration, NotificationChannel } from '@krasterisk/shared';

export interface ICreateNotificationIntegration {
  name: string;
  channel: NotificationChannel;
  config?: Record<string, unknown>;
  /** Secret credentials — sent on create/update, never returned in responses */
  credentials?: Record<string, unknown>;
}

export interface IUpdateNotificationIntegration {
  name?: string;
  channel?: NotificationChannel;
  config?: Record<string, unknown>;
  credentials?: string;
}

const notificationApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<INotificationIntegration[], void>({
      query: () => '/notifications',
      providesTags: ['Notifications'],
    }),
    getNotification: build.query<INotificationIntegration, number>({
      query: (uid) => `/notifications/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'Notifications', id: uid }],
    }),
    createNotification: build.mutation<INotificationIntegration, ICreateNotificationIntegration>({
      query: (body) => ({
        url: '/notifications',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Notifications'],
    }),
    updateNotification: build.mutation<
      INotificationIntegration,
      { uid: number; data: IUpdateNotificationIntegration }
    >({
      query: ({ uid, data }) => ({
        url: `/notifications/${uid}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Notifications'],
    }),
    deleteNotification: build.mutation<void, number>({
      query: (uid) => ({
        url: `/notifications/${uid}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetNotificationQuery,
  useCreateNotificationMutation,
  useUpdateNotificationMutation,
  useDeleteNotificationMutation,
} = notificationApi;
