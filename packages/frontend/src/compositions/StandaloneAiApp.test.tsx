import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StandaloneAiApp } from './StandaloneAiApp';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function healthOk(profile = 'analytics-api') {
  return { ok: true, json: async () => ({ status: 'ok', profile, productRuntime: 'not-installed' }) };
}

describe('standalone AI composition shell', () => {
  it('shows separate API and product runtime status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthOk()));
    render(<StandaloneAiApp product="analytics-api" />);
    expect(screen.getByRole('heading', { name: 'Речевая аналитика' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API подключён'));
    expect(screen.getByText('Не установлен')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'omit', cache: 'no-store' }));
  });

  it('does not treat the other product profile as connected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthOk('analytics-api')));
    render(<StandaloneAiApp product="robot-api" />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Подключён API другого продукта'));
  });

  it('signs in through identity HTTP and shows capabilities without persisting the token', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/health') return healthOk();
      if (url === '/api/auth/login') {
        return { ok: true, json: async () => ({ accessToken: 'access', expiresInSeconds: 7200 }) };
      }
      if (url === '/api/v1/identity/capabilities') {
        return {
          ok: true,
          json: async () => ({
            tenantUid: 42, principalKind: 'user', productRuntime: 'not-installed', usable: false,
            entitlement: { product: 'speech_analytics', allowed: false, reason: 'license_invalid' },
          }),
        };
      }
      throw new Error(url);
    });
    vi.stubGlobal('fetch', fetchMock);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<StandaloneAiApp product="analytics-api" />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API подключён'));
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'correct horse' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Войти' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('42')).toBeTruthy());
    expect(screen.getByText('Нет лицензии')).toBeTruthy();
    expect(setItem).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST', credentials: 'omit' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/identity/capabilities', expect.objectContaining({
      headers: { authorization: 'Bearer access' },
    }));
    expect(screen.getByText('Первый запуск')).toBeTruthy();
    expect(screen.getByText('Проект')).toBeTruthy();
    expect(screen.getByText('Ключ интеграции')).toBeTruthy();
    expect(screen.queryByText(/AMI|ARI|PBX|CDR|queue_log/i)).toBeNull();
  });

  it('shows expired and entitled-not-installed as distinct access states', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/health') return healthOk();
      if (url === '/api/auth/login') {
        return { ok: true, json: async () => ({ accessToken: 'access', expiresInSeconds: 7200 }) };
      }
      if (url === '/api/v1/identity/capabilities') {
        return {
          ok: true,
          json: async () => ({
            tenantUid: 8, principalKind: 'user', productRuntime: 'expired', usable: false,
            entitlement: { product: 'speech_analytics', allowed: false, reason: 'license_expired' },
          }),
        };
      }
      throw new Error(url);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<StandaloneAiApp product="analytics-api" />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API подключён'));
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'correct horse' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Войти' }).closest('form')!);
    await waitFor(() => expect(screen.getAllByText('Срок лицензии истёк').length).toBeGreaterThan(0));
  });

  it('keeps the session empty after invalid credentials', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/health') return healthOk();
      return { ok: false, json: async () => ({ code: 'credential_invalid' }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<StandaloneAiApp product="analytics-api" />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API подключён'));
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Войти' }).closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Неверный логин или пароль'));
    expect(screen.queryByText('Сеанс администратора')).toBeNull();
  });

  it('shows robots onboarding without an analytics entitlement step', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/health') return healthOk('robot-api');
      if (url === '/api/auth/login') {
        return { ok: true, json: async () => ({ accessToken: 'access', expiresInSeconds: 7200 }) };
      }
      if (url === '/api/v1/identity/capabilities') {
        return {
          ok: true,
          json: async () => ({
            tenantUid: 8, principalKind: 'user', productRuntime: 'not-installed', usable: false,
            entitlement: { product: 'ai_voice_robots', allowed: true, reason: null },
          }),
        };
      }
      throw new Error(url);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<StandaloneAiApp product="robot-api" />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API подключён'));
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'correct horse' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Войти' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('Первый запуск')).toBeTruthy());
    expect(screen.getByText('SIP-профиль')).toBeTruthy();
    expect(screen.queryByText('Ключ интеграции')).toBeNull();
    expect(screen.queryByText(/аналитик/i)).toBeNull();
  });
});
