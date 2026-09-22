import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Select, Switch, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import cls from './ModuleSettings.module.scss';

export interface ModuleSettingsModelOption {
  id: string;
  label: string;
}

export interface ModuleSettingsProps {
  pauseNew: boolean;
  canEditModels?: boolean;
  modelAllowlist?: ModuleSettingsModelOption[];
  sttModelId?: string | null;
  scoreModelId?: string | null;
  insightsModelId?: string | null;
  onPauseChange?: (pauseNew: boolean) => Promise<void>;
  onModelsChange?: (patch: {
    sttModelId?: string | null;
    scoreModelId?: string | null;
    insightsModelId?: string | null;
  }) => Promise<void>;
  /** External error (e.g. RTK mutation); merged with local optimistic failure text. */
  pauseError?: string | null;
}

export const ModuleSettings = memo(({
  pauseNew,
  canEditModels = false,
  modelAllowlist = [],
  sttModelId = null,
  scoreModelId = null,
  insightsModelId = null,
  onPauseChange,
  onModelsChange,
  pauseError = null,
}: ModuleSettingsProps) => {
  const { t } = useTranslation();
  const [localPause, setLocalPause] = useState(pauseNew);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalPause(pauseNew);
  }, [pauseNew]);

  const showModels = canEditModels && modelAllowlist.length > 0;
  const errorText = localError ?? pauseError;

  const handlePause = useCallback(async (next: boolean) => {
    setLocalPause(next);
    setLocalError(null);
    if (!onPauseChange) return;
    try {
      await onPauseChange(next);
    } catch {
      setLocalPause(pauseNew);
      setLocalError(
        t('speechAnalytics.errorSavePause', 'Не удалось сохранить паузу'),
      );
    }
  }, [onPauseChange, pauseNew, t]);

  const handleModel = useCallback(async (
    field: 'sttModelId' | 'scoreModelId' | 'insightsModelId',
    value: string,
  ) => {
    if (!onModelsChange) return;
    await onModelsChange({ [field]: value || null });
  }, [onModelsChange]);

  return (
    <VStack gap="16" max className={cls.wrap} data-testid="sa-module-settings">
      <HStack gap="12" align="center" className={cls.pauseRow}>
        <Switch
          checked={localPause}
          onCheckedChange={(checked) => { void handlePause(Boolean(checked)); }}
          aria-label={t('speechAnalytics.pauseCompanyLabel', 'Пауза новых авторазборов')}
          data-testid="sa-pause-switch"
        />
        <Text>{t('speechAnalytics.pauseCompanyLabel', 'Пауза новых авторазборов')}</Text>
      </HStack>

      {errorText ? (
        <Text className={cls.error} data-testid="sa-pause-error">{errorText}</Text>
      ) : null}

      {!canEditModels ? (
        <Text className={cls.hint} data-testid="sa-models-admin-hint">
          {t('speechAnalytics.modelsAdminOnlyHint', 'Смену моделей включает суперадмин')}
        </Text>
      ) : null}

      {showModels ? (
        <VStack gap="12" max className={cls.models}>
          <VStack gap="4" max className={cls.field}>
            <Label htmlFor="sa-stt-model">
              {t('speechAnalytics.sttModel', 'Модель распознавания')}
            </Label>
            <Select
              id="sa-stt-model"
              data-testid="sa-stt-model-select"
              className={cls.modelSelect}
              value={sttModelId ?? ''}
              onChange={(e) => { void handleModel('sttModelId', e.target.value); }}
            >
              <option value="">{t('speechAnalytics.modelAsModule', 'Как в модуле')}</option>
              {modelAllowlist.map((opt) => (
                <option key={opt.id} value={opt.id} className={cls.modelOption}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </VStack>
          <VStack gap="4" max className={cls.field}>
            <Label htmlFor="sa-score-model">
              {t('speechAnalytics.scoreModel', 'Модель оценок')}
            </Label>
            <Select
              id="sa-score-model"
              data-testid="sa-score-model-select"
              className={cls.modelSelect}
              value={scoreModelId ?? ''}
              onChange={(e) => { void handleModel('scoreModelId', e.target.value); }}
            >
              <option value="">{t('speechAnalytics.modelAsModule', 'Как в модуле')}</option>
              {modelAllowlist.map((opt) => (
                <option key={opt.id} value={opt.id} className={cls.modelOption}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </VStack>
          {insightsModelId !== undefined ? (
            <VStack gap="4" max className={cls.field}>
              <Label htmlFor="sa-insights-model">
                {t('speechAnalytics.insightsModel', 'Модель инсайтов')}
              </Label>
              <Select
                id="sa-insights-model"
                data-testid="sa-insights-model-select"
                className={cls.modelSelect}
                value={insightsModelId ?? ''}
                onChange={(e) => { void handleModel('insightsModelId', e.target.value); }}
              >
                <option value="">{t('speechAnalytics.modelAsModule', 'Как в модуле')}</option>
                {modelAllowlist.map((opt) => (
                  <option key={opt.id} value={opt.id} className={cls.modelOption}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </VStack>
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
});

ModuleSettings.displayName = 'ModuleSettings';
