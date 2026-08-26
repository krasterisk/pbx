import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PlatformLayout } from './PlatformLayout';
import { RequireRole } from '@/app/router/RequireRole';
import { UserLevel } from '@/entities/User';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

function makeStore(level: UserLevel | undefined, isAuthenticated = true) {
  return configureStore({
    reducer: {
      auth: () => ({
        isAuthenticated,
        user: level === undefined ? null : { level },
      }),
    },
  });
}

function renderPlatform(level: UserLevel | undefined, isAuthenticated = true) {
  const store = makeStore(level, isAuthenticated);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/platform/tenants']}>
        <Routes>
          <Route
            path="/platform"
            element={
              <RequireRole allow={[UserLevel.SUPERADMIN]}>
                <PlatformLayout />
              </RequireRole>
            }
          >
            <Route path="tenants" element={<div data-testid="tenants-child">tenants</div>} />
          </Route>
          <Route path="/" element={<div data-testid="home">home</div>} />
          <Route path="/login" element={<div data-testid="login">login</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('PlatformLayout (NAV-06 / 006-B)', () => {
  it('exports PlatformLayout and wraps /platform with console-chrome cue', () => {
    renderPlatform(UserLevel.SUPERADMIN);
    expect(screen.getByTestId('platform-layout')).toBeInTheDocument();
    expect(screen.getByTestId('platform-console-chrome')).toBeInTheDocument();
    expect(screen.getByText('platform console')).toBeInTheDocument();
    expect(screen.getByTestId('tenants-child')).toBeInTheDocument();
  });

  it('redirects non-superadmin away from /platform', () => {
    renderPlatform(UserLevel.ADMIN);
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('platform-layout')).not.toBeInTheDocument();
  });

  it('does not render platform catalog tabs inside tenant AppLayout (separate tree)', () => {
    renderPlatform(UserLevel.SUPERADMIN);
    // Platform nav lives only under PlatformLayout - no ModuleShell/AppLayout chrome
    expect(screen.queryByTestId('module-shell')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Platform console' })).toBeInTheDocument();
  });
});
