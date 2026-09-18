import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
vi.mock('@/widgets/AuthFrame/AuthFrame', () => ({ AuthFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

describe('organization registration', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => vi.unstubAllGlobals());
  function fill(password = 'test-password') {
    fireEvent.change(screen.getByLabelText('Организация'), { target: { value: 'Test Company' } });
    fireEvent.change(screen.getByLabelText('Имя администратора'), { target: { value: 'Test Owner' } });
    fireEvent.change(screen.getByLabelText('auth.loginPlaceholder'), { target: { value: 'test-owner' } });
    fireEvent.change(screen.getByLabelText('Пароль (минимум 8 символов)'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Повторите пароль'), { target: { value: 'test-password' } });
  }
  it('omits empty optional email and goes to login after creating an active tenant', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ requiresActivation: false }) });
    vi.stubGlobal('fetch', fetch); render(<RegisterPage />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Создать организацию' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login', expect.anything()));
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.companyName).toBe('Test Company'); expect(body).not.toHaveProperty('email');
  });
  it('rejects mismatching passwords before sending anything', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); render(<RegisterPage />); fill('other-password');
    fireEvent.click(screen.getByRole('button', { name: 'Создать организацию' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Пароли не совпадают');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('routes email registrations to activation and shows server validation errors', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ message: ['Login exists'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ requiresActivation: true }) });
    vi.stubGlobal('fetch', fetch); render(<RegisterPage />); fill();
    fireEvent.change(screen.getByLabelText('Email для подтверждения (необязательно)'), { target: { value: 'test@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать организацию' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Login exists'));
    fireEvent.click(screen.getByRole('button', { name: 'Создать организацию' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/activate', expect.anything()));
  });
});
