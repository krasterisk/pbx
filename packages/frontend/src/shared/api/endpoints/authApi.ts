import { rtkApi } from '@/shared/api/rtkApi';

export interface AuthConfig {
  registrationEnabled: boolean;
}

export const authApi = rtkApi.injectEndpoints({
  overrideExisting: import.meta.hot != null,
  endpoints: (build) => ({
    getAuthConfig: build.query<AuthConfig, void>({
      query: () => '/auth/config',
      providesTags: ['AuthConfig'],
    }),
    getRegistrationPolicy: build.query<AuthConfig, void>({
      query: () => '/cloud-admin/registration-policy',
      providesTags: ['AuthConfig'],
    }),
    updateRegistrationPolicy: build.mutation<AuthConfig, AuthConfig>({
      query: (body) => ({
        url: '/cloud-admin/registration-policy',
        method: 'PUT',
        body,
      }),
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        const patchPolicy = dispatch(
          authApi.util.updateQueryData('getRegistrationPolicy', undefined, (draft) => {
            draft.registrationEnabled = body.registrationEnabled;
          }),
        );
        const patchPublic = dispatch(
          authApi.util.updateQueryData('getAuthConfig', undefined, (draft) => {
            draft.registrationEnabled = body.registrationEnabled;
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(authApi.util.updateQueryData('getRegistrationPolicy', undefined, () => data));
          dispatch(authApi.util.updateQueryData('getAuthConfig', undefined, () => data));
        } catch {
          patchPolicy.undo();
          patchPublic.undo();
        }
      },
    }),
  }),
});

export const {
  useGetAuthConfigQuery,
  useGetRegistrationPolicyQuery,
  useUpdateRegistrationPolicyMutation,
} = authApi;
