import { configureStore } from '@reduxjs/toolkit';
import { rtkApi } from '@/shared/api/rtkApi';
import { authReducer } from '@/features/auth/model/authSlice';
import { usersPageReducer } from '@/features/users/model/slice/usersPageSlice';
import { endpointsPageReducer } from '@/features/endpoints/model/slice/endpointsPageSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    usersPage: usersPageReducer,
    endpointsPage: endpointsPageReducer,
    [rtkApi.reducerPath]: rtkApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(rtkApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
