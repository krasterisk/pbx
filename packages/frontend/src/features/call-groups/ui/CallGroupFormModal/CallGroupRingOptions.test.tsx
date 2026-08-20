import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CallGroupRingOptions, type CallGroupRingOptionsValue } from './CallGroupRingOptions';
import * as promptsApi from '@/shared/api/endpoints/promptsApi';
import * as mohApi from '@/shared/api/endpoints/mohApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/endpoints/promptsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetPromptsQuery: vi.fn(),
  };
});

vi.mock('@/shared/api/endpoints/mohApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetMohClassesQuery: vi.fn(),
  };
});

const defaultValue: CallGroupRingOptionsValue = {
  confirmExternal: false,
  skipBusy: false,
  greetingPrompt: '',
  mohClass: '',
  useMohInsteadOfRingback: false,
  dialOptions: 'tT',
};

function renderOptions(
  value: Partial<CallGroupRingOptionsValue> = {},
  onChange = vi.fn(),
) {
  return render(
    <CallGroupRingOptions value={{ ...defaultValue, ...value }} onChange={onChange} />,
  );
}

describe('CallGroupRingOptions (D-34)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (promptsApi.useGetPromptsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ uid: 1, filename: 'welcome', comment: 'Welcome' }],
      isLoading: false,
    });
    (mohApi.useGetMohClassesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ name: 'moh_15_sales', displayName: 'Sales' }],
      isLoading: false,
    });
  });

  it('renders all five ring controls by their Copywriting Contract names', () => {
    renderOptions();
    expect(screen.getByRole('switch', { name: 'Подтверждение вызова' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Пропускать занятых' })).toBeInTheDocument();
    expect(screen.getByLabelText('Приветствие абоненту')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Музыка вместо гудков' })).toBeInTheDocument();
    expect(screen.getByLabelText(/опци/i)).toBeInTheDocument();
  });

  it('explains why confirm is needed using the Copywriting Contract reason', () => {
    renderOptions();
    expect(screen.getByText(/голосовая почта оператора принимает вызов за человека/)).toBeInTheDocument();
  });

  it('disables MOH class select while MOH is off and enables it when on', () => {
    const { rerender } = renderOptions({ useMohInsteadOfRingback: false });
    expect(screen.getByLabelText('Класс музыки удержания')).toBeDisabled();

    rerender(
      <CallGroupRingOptions
        value={{ ...defaultValue, useMohInsteadOfRingback: true }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Класс музыки удержания')).not.toBeDisabled();
  });

  it('shows distinct loading vs empty catalog copy for prompts', () => {
    (promptsApi.useGetPromptsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: true,
    });
    const { rerender } = renderOptions();
    const loading = screen.getByLabelText('Приветствие абоненту');
    expect(loading).toBeDisabled();
    expect(loading).toHaveTextContent('Загружаем список');

    (promptsApi.useGetPromptsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
    rerender(<CallGroupRingOptions value={defaultValue} onChange={vi.fn()} />);
    const empty = screen.getByLabelText('Приветствие абоненту');
    expect(empty).toBeDisabled();
    expect(empty).toHaveTextContent('Ничего не создано');
    expect(empty.textContent).not.toBe('Загружаем список');
    expect(screen.getByRole('link', { name: /Открыть раздел/ })).toBeInTheDocument();
  });
});
