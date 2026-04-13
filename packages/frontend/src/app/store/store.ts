import { configureStore } from '@reduxjs/toolkit';
import { rtkApi } from '@/shared/api/rtkApi';
import { authReducer } from '@/features/auth/model/authSlice';
import { usersPageReducer } from '@/features/users/model/slice/usersPageSlice';
import { endpointsPageReducer } from '@/features/endpoints/model/slice/endpointsPageSlice';
import { trunksPageReducer } from '@/features/trunks/model/slice/trunksPageSlice';
import { provisionTemplatesReducer } from '@/features/provisionTemplates/model/slice/provisionTemplatesSlice';
import { contextsReducer } from '@/features/contexts/model/slice/contextsSlice';
import { routesReducer } from '@/features/routes/model/slice/routesSlice';
import { rolesPageReducer } from '@/features/roles';
import { numbersPageReducer } from '@/features/numbers';
import { ivrsReducer } from '@/features/ivrs/model/slice/ivrsSlice';
import { promptsReducer } from '@/features/prompts/model/slice/promptsSlice';
import { mohReducer } from '@/features/moh/model/slice/mohSlice';
import { ttsEnginesReducer } from '@/features/tts-engines/model/slice/ttsEnginesSlice';
import { sttEnginesReducer } from '@/features/stt-engines/model/slice/sttEnginesSlice';
import { voiceRobotsReducer } from '@/features/voiceRobots/model/slice/voiceRobotsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    usersPage: usersPageReducer,
    endpointsPage: endpointsPageReducer,
    trunksPage: trunksPageReducer,
    provisionTemplates: provisionTemplatesReducer,
    contexts: contextsReducer,
    routes: routesReducer,
    rolesPage: rolesPageReducer,
    numbersPage: numbersPageReducer,
    ivrs: ivrsReducer,
    prompts: promptsReducer,
    moh: mohReducer,
    ttsEngines: ttsEnginesReducer,
    sttEngines: sttEnginesReducer,
    voiceRobots: voiceRobotsReducer,
    [rtkApi.reducerPath]: rtkApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(rtkApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export type StateSchema = RootState;

