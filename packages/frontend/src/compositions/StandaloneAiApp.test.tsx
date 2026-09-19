import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { StandaloneAiApp } from './StandaloneAiApp';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('standalone AI composition shell', () => {
  it('shows separate API and product runtime status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', profile: 'analytics-api', productRuntime: 'not-installed' }),
    }));
    render(<StandaloneAiApp product="analytics-api" />);
    expect(screen.getByRole('heading', { name: 'Речевая аналитика' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API подключён'));
    expect(screen.getByText('Не установлен')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'omit', cache: 'no-store' }));
  });

  it('does not treat the other product profile as connected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', profile: 'analytics-api', productRuntime: 'not-installed' }),
    }));
    render(<StandaloneAiApp product="robot-api" />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Подключён API другого продукта'));
  });
});
