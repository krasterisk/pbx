import { configureStore } from '@reduxjs/toolkit';
import { rtkApi } from '@/shared/api/rtkApi';
import { authReducer } from '@/features/auth/model/authSlice';
import { usersPageReducer } from '@/features/users/model/slice/usersPageSlice';
import { endpointsPageReducer } from '@/features/endpoints/model/slice/endpointsPageSlice';
import { trunksPageReducer } from '@/features/trunks/model/slice/trunksPageSlice';
import { provisionTemplatesReducer } from '@/features/provisionTemplates/model/slice/provisionTemplatesSlice';
import { contextsReducer } from '@/features/contexts/model/slice/contextsSlice';
import { routesReducer } from '@/features/routes/model/slice/routesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    usersPage: usersPageReducer,
    endpointsPage: endpointsPageReducer,
    trunksPage: trunksPageReducer,
    provisionTemplates: provisionTemplatesReducer,
    contexts: contextsReducer,
    routes: routesReducer,
    [rtkApi.reducerPath]: rtkApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(rtkApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
