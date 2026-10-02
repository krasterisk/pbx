import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { UserLevel } from '@krasterisk/shared';

const update = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-toastify', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock('@/shared/api/endpoints/authApi', () => ({
  useGetRegistrationPolicyQuery: () => ({
    data: { registrationEnabled: false },
    isLoading: false,
  }),
  useUpdateRegistrationPolicyMutation: () => [
    (body: { registrationEnabled: boolean }) => {
      update(body);
      return { unwrap: () => Promise.resolve(body) };
    },
    { isLoading: false },
  ],
}));

import { RegistrationPolicyCard } from './RegistrationPolicyCard';

function renderCard(level: UserLevel) {
  const store = configureStore({
    reducer: {
      auth: () => ({ isAuthenticated: true, user: { level } }),
    },
  });
  return render(
    <Provider store={store}>
      <RegistrationPolicyCard />
    </Provider>,
  );
}

describe('RegistrationPolicyCard', () => {
  it('hides the switch from tenant roles', () => {
    renderCard(UserLevel.ADMIN);
    expect(screen.queryByTestId('registration-policy-card')).not.toBeInTheDocument();
  });

  it('saves the registration flag immediately for a superadmin', () => {
    renderCard(UserLevel.SUPERADMIN);
    expect(screen.getByTestId('registration-policy-card')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('registration-enabled'));
    expect(update).toHaveBeenCalledWith({ registrationEnabled: true });
  });
});
