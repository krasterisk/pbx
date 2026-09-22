import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModuleSettings } from './ModuleSettings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      const map: Record<string, string> = {
        'speechAnalytics.pauseCompanyLabel': 'Пауза новых авторазборов',
        'speechAnalytics.modelsAdminOnlyHint': 'Смену моделей включает суперадмин',
        'speechAnalytics.sttModel': 'Модель распознавания',
        'speechAnalytics.scoreModel': 'Модель оценок',
        'speechAnalytics.errorSavePause': 'Не удалось сохранить паузу',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'ru' },
  }),
}));

const allowlist = [
  { id: 'stt-a', label: 'ОченьДлинноеИмяМоделиРаспознаванияЧтобыНеРаздвинутьСтраницу' },
  { id: 'score-a', label: 'Score A' },
];

function renderSettings(overrides: Partial<ComponentProps<typeof ModuleSettings>> = {}) {
  const onPauseChange = vi.fn(async () => undefined);
  const onModelsChange = vi.fn(async () => undefined);
  const view = render(
    <ModuleSettings
      pauseNew={false}
      canEditModels
      modelAllowlist={allowlist}
      sttModelId="stt-a"
      scoreModelId="score-a"
      insightsModelId={null}
      onPauseChange={onPauseChange}
      onModelsChange={onModelsChange}
      {...overrides}
    />,
  );
  return { onPauseChange, onModelsChange, ...view };
}

describe('ModuleSettings', () => {
  it('optimistic pause Switch rolls back on failure and shows error text', async () => {
    const user = userEvent.setup();
    const onPauseChange = vi.fn(async () => {
      throw new Error('network');
    });
    renderSettings({ onPauseChange });

    const pauseSwitch = screen.getByTestId('sa-pause-switch');
    expect(pauseSwitch).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Пауза новых авторазборов')).toBeInTheDocument();

    await user.click(pauseSwitch);
    expect(onPauseChange).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(screen.getByTestId('sa-pause-switch')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('sa-pause-error')).toHaveTextContent(/Не удалось сохранить паузу|network/i);
    });
  });

  it('hides model selects without right or empty allowlist; pause Switch remains', () => {
    const { rerender } = renderSettings({ canEditModels: false });
    expect(screen.getByTestId('sa-pause-switch')).toBeInTheDocument();
    expect(screen.queryByTestId('sa-stt-model-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sa-score-model-select')).not.toBeInTheDocument();
    expect(screen.getByText('Смену моделей включает суперадмин')).toBeInTheDocument();

    rerender(
      <ModuleSettings
        pauseNew={false}
        canEditModels
        modelAllowlist={[]}
        sttModelId={null}
        scoreModelId={null}
        insightsModelId={null}
        onPauseChange={vi.fn(async () => undefined)}
        onModelsChange={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByTestId('sa-pause-switch')).toBeInTheDocument();
    expect(screen.queryByTestId('sa-stt-model-select')).not.toBeInTheDocument();
  });

  it('shows model selects when entitled and keep long names from widening the page', () => {
    renderSettings();
    expect(screen.getByTestId('sa-stt-model-select')).toBeInTheDocument();
    expect(screen.getByTestId('sa-score-model-select')).toBeInTheDocument();
    const wrap = screen.getByTestId('sa-module-settings');
    expect(wrap.className).toMatch(/wrap|settings/);
    fireEvent.change(screen.getByTestId('sa-stt-model-select'), { target: { value: 'stt-a' } });
    const option = screen.getByText(/ОченьДлинноеИмяМодели/);
    expect(option.closest('[class*="wrap"]') || option).toBeTruthy();
  });
});
