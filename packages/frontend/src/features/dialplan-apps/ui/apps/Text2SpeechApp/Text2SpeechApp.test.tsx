import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Text2SpeechApp } from './Text2SpeechApp';
import * as ttsApi from '@/shared/api/endpoints/ttsEnginesApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/endpoints/ttsEnginesApi', () => ({
  useGetTtsEnginesQuery: vi.fn(),
}));

describe('Text2SpeechApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ttsApi.useGetTtsEnginesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { uid: 3, name: 'Yandex', type: 'yandex' },
        { uid: 5, name: 'Custom', type: 'custom' },
      ],
      isLoading: false,
    });
  });

  it('renders an engine select from the catalog, not a free-text engine field', () => {
    render(<Text2SpeechApp params={{ text: 'hello', engine: '' }} onChange={vi.fn()} />);

    const select = screen.getByLabelText(/движок|engine/i) as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toContain('3');
    expect(values).toContain('5');
    expect(screen.queryByRole('textbox', { name: /движок|engine/i })).toBeNull();
  });
});
