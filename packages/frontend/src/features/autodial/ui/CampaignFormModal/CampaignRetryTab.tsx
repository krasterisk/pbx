import { memo } from "react";
import { useTranslation } from "react-i18next";
import { InfoTooltip, Input, Label, Text } from "@/shared/ui";
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
              {t("autodial.retry.defaultInterval")}
            </Label>
            <InfoTooltip text={t("autodial.retry.defaultIntervalHint")} />
          </HStack>
          <Input
            id="autodial-retry-default"
            type="number"
            min={0}
            className={cls.narrowInput}
            value={draft.retry.default_interval_sec}
            onChange={(e) =>
              patchRetry({ default_interval_sec: Number(e.target.value) || 0 })
            }
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
              <Input
                id={`autodial-retry-${disposition}`}
                type="number"
                min={0}
                className={cls.narrowInput}
                placeholder={String(draft.retry.default_interval_sec)}
                value={draft.retry.intervals_sec[disposition] ?? ""}
                onChange={(e) =>
                  patchRetry({
                    intervals_sec: {
                      ...draft.retry.intervals_sec,
                      [disposition]:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
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
