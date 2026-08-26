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
    i18n: { language: 'ru' },
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
  confirmDigit: '1',
  skipBusy: false,
  useGreeting: false,
  greetingPrompt: '',
  mohClass: '',
  useMohInsteadOfRingback: false,
  dialOptions: 'tT',
};

function renderOptions(
  value: Partial<CallGroupRingOptionsValue> = {},
  onChange = vi.fn(),
  hasExternalMembers = true,
) {
  return render(
    <CallGroupRingOptions
      value={{ ...defaultValue, ...value }}
      onChange={onChange}
      hasExternalMembers={hasExternalMembers}
    />,
  );
}

function expandSection() {
  fireEvent.click(screen.getByRole('button', { name: /Настройки обзвона/i }));
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

  it('keeps ring settings collapsed by default', () => {
    renderOptions();
    expect(screen.getByRole('button', { name: /Настройки обзвона/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('switch', { name: 'Пропускать занятых' })).not.toBeInTheDocument();
  });

  it('renders ring controls after expanding the section', () => {
    renderOptions();
    expandSection();
    expect(screen.getByRole('switch', { name: 'Подтверждение вызова' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Пропускать занятых' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Приветствие абоненту' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Запись приветствия')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Музыка вместо гудков' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Опции Dial/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^m -/ })).not.toBeInTheDocument();
  });

  it('shows greeting prompt select only when greeting is enabled', () => {
    const onChange = vi.fn();
    const { rerender } = renderOptions({ useGreeting: false }, onChange);
    expandSection();
    expect(screen.queryByLabelText('Запись приветствия')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Приветствие абоненту' }));
    expect(onChange).toHaveBeenCalledWith({ useGreeting: true });

    rerender(
      <CallGroupRingOptions
        value={{ ...defaultValue, useGreeting: true }}
        onChange={onChange}
        hasExternalMembers
      />,
    );
    expect(screen.getByLabelText('Запись приветствия')).toBeInTheDocument();
  });

  it('clears greeting prompt when greeting is turned off', () => {
    const onChange = vi.fn();
    renderOptions({ useGreeting: true, greetingPrompt: 'welcome' }, onChange);
    expandSection();
    fireEvent.click(screen.getByRole('switch', { name: 'Приветствие абоненту' }));
    expect(onChange).toHaveBeenCalledWith({ useGreeting: false, greetingPrompt: '' });
  });

  it('hides confirm when there are no external members', () => {
    renderOptions({}, vi.fn(), false);
    expandSection();
    expect(screen.queryByRole('switch', { name: 'Подтверждение вызова' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Пропускать занятых' })).toBeInTheDocument();
  });

  it('shows confirm digit select when confirmation is enabled', () => {
    const onChange = vi.fn();
    renderOptions({ confirmExternal: true, confirmDigit: '1' }, onChange);
    expandSection();
    const digitSelect = screen.getByLabelText('Цифра подтверждения');
    expect(digitSelect).toBeInTheDocument();
    fireEvent.change(digitSelect, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({ confirmDigit: '5' });
  });

  it('hides confirm digit select while confirmation is off', () => {
    renderOptions({ confirmExternal: false });
    expandSection();
    expect(screen.queryByLabelText('Цифра подтверждения')).not.toBeInTheDocument();
  });

  it('exposes a clear confirm tooltip about external answer and voicemail', () => {
    renderOptions();
    expandSection();
    expect(screen.getByRole('switch', { name: 'Подтверждение вызова' })).toBeInTheDocument();
    // Body must not repeat the tooltip copy as plain text under the switch.
    expect(screen.queryByText(/автоответчик или голосовая почта/)).not.toBeInTheDocument();
  });

  it('strips m from dial options when editing the string', () => {
    const onChange = vi.fn();
    renderOptions({ dialOptions: 'tT' }, onChange);
    expandSection();
    fireEvent.click(screen.getByRole('button', { name: /Опции Dial/i }));
    fireEvent.click(screen.getByRole('button', { name: /Показать строку опций/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /строк/i }), {
      target: { value: 'tTm' },
    });
    expect(onChange).toHaveBeenCalledWith({ dialOptions: 'tT' });
  });

  it('keeps Dial options collapsed by default inside the section', () => {
    renderOptions();
    expandSection();
    expect(screen.queryByRole('checkbox', { name: /t -/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Опции Dial/i }));
    expect(screen.getByRole('checkbox', { name: /t -/ })).toBeInTheDocument();
  });

  it('disables MOH class select while MOH is off and enables it when on', () => {
    const { rerender } = renderOptions({ useMohInsteadOfRingback: false });
    expandSection();
    expect(screen.getByLabelText('Класс музыки удержания')).toBeDisabled();

    rerender(
      <CallGroupRingOptions
        value={{ ...defaultValue, useMohInsteadOfRingback: true }}
        onChange={vi.fn()}
        hasExternalMembers
      />,
    );
    expect(screen.getByLabelText('Класс музыки удержания')).not.toBeDisabled();
  });

  it('shows distinct loading vs empty catalog copy for prompts', () => {
    (promptsApi.useGetPromptsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: true,
    });
    const { rerender } = renderOptions({ useGreeting: true });
    expandSection();
    const loading = screen.getByLabelText('Запись приветствия');
    expect(loading).toBeDisabled();
    expect(loading).toHaveTextContent('Загружаем список');

    (promptsApi.useGetPromptsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
    rerender(
      <CallGroupRingOptions
        value={{ ...defaultValue, useGreeting: true }}
        onChange={vi.fn()}
        hasExternalMembers
      />,
    );
    const empty = screen.getByLabelText('Запись приветствия');
    expect(empty).toBeDisabled();
    expect(empty).toHaveTextContent('Ничего не создано');
    expect(empty.textContent).not.toBe('Загружаем список');
    expect(screen.getByRole('link', { name: /Открыть раздел/ })).toBeInTheDocument();
  });
});
