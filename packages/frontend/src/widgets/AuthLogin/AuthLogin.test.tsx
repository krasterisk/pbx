import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

const authConfig = vi.hoisted(() => ({ registrationEnabled: true }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { year?: number }) =>
      typeof options === 'string' ? options : key,
    i18n: { language: 'ru', changeLanguage: vi.fn() },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('@/shared/api/endpoints/authApi', () => ({
  useGetAuthConfigQuery: () => ({
    data: { registrationEnabled: authConfig.registrationEnabled },
    isLoading: false,
    isError: false,
  }),
}));

import { AuthLogin } from './AuthLogin';

function renderLogin() {
  const store = configureStore({
    reducer: {
      auth: () => ({ isLoading: false, error: null }),
    },
  });
  return render(
    <Provider store={store}>
      <AuthLogin />
    </Provider>,
  );
}

describe('AuthLogin', () => {
  it('offers organization signup when registration is enabled', () => {
    authConfig.registrationEnabled = true;
    renderLogin();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    expect(screen.getByLabelText('auth.loginPlaceholder')).toBeInTheDocument();
  });

  it('keeps login only when registration is disabled', () => {
    authConfig.registrationEnabled = false;
    renderLogin();
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('auth.passwordPlaceholder')).toBeInTheDocument();
  });
});
