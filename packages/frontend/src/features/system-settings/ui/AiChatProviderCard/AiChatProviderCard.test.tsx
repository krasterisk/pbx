import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import { rtkApi } from '@/shared/api/rtkApi';

const { roleFlags, speechModels } = vi.hoisted(() => ({
  roleFlags: { admin: true, superAdmin: false },
  speechModels: { ownModels: true },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (sel: () => unknown) => sel(),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/entities/User', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/User')>();
  return {
    ...actual,
    selectIsAdmin: () => roleFlags.admin,
    selectIsSuperAdmin: () => roleFlags.superAdmin,
  };
});

vi.mock('@/features/speechAnalytics/api/speechAnalyticsApi', () => ({
  useGetSaSpeechModelsQuery: () => ({ data: { ownModels: speechModels.ownModels } }),
}));

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useGetAiProvidersQuery: () => ({
    data: [
      {
        uid: 7,
        name: 'Tenant LLM',
        vendor: 'openai',
        enabled: true,
        capabilities: ['llm'],
        defaults: { model: 'gpt-4o-mini' },
      },
    ],
    isLoading: false,
  }),
}));

import { AiChatProviderCard } from './AiChatProviderCard';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createStore() {
  return configureStore({
    reducer: { [rtkApi.reducerPath]: rtkApi.reducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(rtkApi.middleware),
  });
}

let putGate: {
  resolve: (value: Response) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<Response>;
};

function renderCard() {
  const store = createStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <AiChatProviderCard />
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe('AiChatProviderCard', () => {
  beforeEach(() => {
    roleFlags.admin = true;
    roleFlags.superAdmin = false;
    speechModels.ownModels = true;
    let resolve!: (value: Response) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<Response>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    putGate = { resolve, reject, promise };

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        const method = (input instanceof Request ? input.method : init?.method ?? 'GET').toUpperCase();
        if (url.includes('/ai-chat/settings') && method === 'PUT') {
          return putGate.promise;
        }
        if (url.includes('/ai-chat/settings')) {
          return Promise.resolve(jsonResponse({ confirmDestructive: false, seeAllThreads: false }));
        }
        if (url.includes('/ai-chat/default-provider')) {
          return Promise.resolve(jsonResponse({ providerUid: 7 }));
        }
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets the tenant pick a chat LLM and links to providers', async () => {
    renderCard();
    expect(screen.getByTestId('ai-chat-provider-card')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('ai-chat-provider')).toHaveValue('7'));
    expect(screen.getByTestId('ai-chat-all-providers')).toHaveAttribute('href', '/ai-providers');
  });

  it('does not show the platform see-all-threads switch', async () => {
    renderCard();
    await waitFor(() => expect(screen.getByTestId('ai-chat-provider')).toHaveValue('7'));
    expect(screen.queryByRole('switch', { name: 'systemSettings.aiChatSeeAllThreads' })).toBeNull();
  });

  it('hides the model override when the cabinet cannot use its own models', () => {
    speechModels.ownModels = false;
    renderCard();
    expect(screen.queryByTestId('ai-chat-provider-card')).toBeNull();
  });
});
