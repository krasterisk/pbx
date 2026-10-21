import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button, InfoTooltip, Input, Label, Text } from "@/shared/ui";
import { DurationInput } from '../DurationInput/DurationInput';
import { HStack, VStack } from "@/shared/ui/Stack";
import {
  RETRY_INTERVAL_DISPOSITIONS,
  type AutodialCampaignDraft,
} from "../../model/campaignDraft";
import { autodialDispositionLabel } from "../../lib/labels";
import cls from "./CampaignTabs.module.scss";

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
}

export const CampaignRetryTab = memo(({ draft, onChange }: Props) => {
  const { t } = useTranslation();

  const patchRetry = (part: Partial<AutodialCampaignDraft["retry"]>) =>
    onChange({ ...draft, retry: { ...draft.retry, ...part } });

  return (
    <VStack gap="16" max>
      <HStack gap="8" wrap="wrap"><Button variant="outline" onClick={() => patchRetry({ max_attempts: 3, default_interval_sec: 7200,
        intervals_sec: { no_answer: 14400, busy: 7200, congestion: 7200, failed: 14400, answered_short: 86400, amd_machine: 86400, voicemail: 86400 } })}>{t('autodial.workspace.retryGentle')}</Button>
        <Button variant="outline" onClick={() => patchRetry({ max_attempts: 3, default_interval_sec: 3600,
          intervals_sec: { no_answer: 7200, busy: 1800, congestion: 3600, failed: 7200, answered_short: 14400, amd_machine: 86400, voicemail: 86400 } })}>{t('autodial.workspace.retryStandard')}</Button>
      </HStack>
      <div className={cls.grid}>
        <VStack gap="8" max className={cls.field}>
          <HStack gap="4" align="center">
            <Label htmlFor="autodial-retry-max" className={cls.fieldLabel}>
              {t("autodial.retry.maxAttempts")}
            </Label>
            <InfoTooltip text={t("autodial.retry.maxAttemptsHint")} />
          </HStack>
          <Input
            id="autodial-retry-max"
            type="number"
            min={1}
            className={cls.narrowInput}
            value={draft.retry.max_attempts}
            onChange={(e) =>
              patchRetry({ max_attempts: Number(e.target.value) || 1 })
            }
          />
        </VStack>

        <VStack gap="8" max className={cls.field}>
          <HStack gap="4" align="center">
            <Label htmlFor="autodial-retry-default" className={cls.fieldLabel}>
              {t('autodial.workspace.retryInterval')}
            </Label>
            <InfoTooltip text={t("autodial.retry.defaultIntervalHint")} />
          </HStack>
          <DurationInput
            id="autodial-retry-default"
            label={t('autodial.workspace.retryInterval')}
            value={draft.retry.default_interval_sec}
            onChange={(value) => patchRetry({ default_interval_sec: value ?? 0 })}
          />
        </VStack>
      </div>

      <VStack gap="8" max>
        <HStack gap="4" align="center">
          <Text className={cls.sectionTitle}>
            {t("autodial.retry.perDisposition")}
          </Text>
          <InfoTooltip text={t("autodial.retry.perDispositionHint")} />
        </HStack>
        <div className={cls.grid}>
          {RETRY_INTERVAL_DISPOSITIONS.map((disposition) => (
            <VStack gap="8" max key={disposition} className={cls.field}>
              <Label htmlFor={`autodial-retry-${disposition}`} className={cls.fieldLabel}>
                {autodialDispositionLabel(disposition, t)}
              </Label>
              <DurationInput
                id={`autodial-retry-${disposition}`}
                label={autodialDispositionLabel(disposition, t)}
                fallback={draft.retry.default_interval_sec}
                value={draft.retry.intervals_sec[disposition]}
                onChange={(value) =>
                  patchRetry({
                    intervals_sec: {
                      ...draft.retry.intervals_sec,
                      [disposition]:
                        value,
                    },
                  })
                }
              />
            </VStack>
          ))}
        </div>
      </VStack>
    </VStack>
  );
});

CampaignRetryTab.displayName = "CampaignRetryTab";
