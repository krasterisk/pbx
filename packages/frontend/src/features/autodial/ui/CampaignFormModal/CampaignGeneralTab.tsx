import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  InfoTooltip,
  Input,
  Label,
  Select,
  Text,
} from "@/shared/ui";
import { HStack, VStack } from "@/shared/ui/Stack";
import { useGetAutodialBasesQuery } from "@/shared/api/endpoints/autodialApi";
import { useGetPromptsQuery } from "@/shared/api/endpoints/promptsApi";
import type {
  AutodialCampaignDraft,
  CampaignDraftErrors,
} from "../../model/campaignDraft";
import cls from "./CampaignTabs.module.scss";

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
  errors: CampaignDraftErrors;
  dialModeOptions: Array<{ value: string; label: string }>;
}

export const CampaignGeneralTab = memo(
  ({ draft, onChange, errors, dialModeOptions }: Props) => {
    const { t } = useTranslation();
    const { data: bases } = useGetAutodialBasesQuery();
    const { data: prompts } = useGetPromptsQuery(undefined, {
      skip: !draft.amd.enabled || draft.amd.on_machine !== "voicemail",
    });

    const patch = (part: Partial<AutodialCampaignDraft>) =>
      onChange({ ...draft, ...part });

    return (
      <VStack gap="16" max>
        <div className={cls.grid}>
          <VStack gap="8" max className={cls.field}>
            <Label htmlFor="autodial-campaign-name" className={cls.fieldLabel}>
              {t("autodial.form.name")} *
            </Label>
            <Input
              id="autodial-campaign-name"
              value={draft.name}
              aria-invalid={Boolean(errors.name) || undefined}
              aria-describedby={errors.name ? "autodial-campaign-name-error" : undefined}
              onChange={(e) => patch({ name: e.target.value })}
            />
            {errors.name && (
              <Text id="autodial-campaign-name-error" className={cls.error}>
                {t("common.fieldRequired")}
              </Text>
            )}
          </VStack>

          <VStack gap="8" max className={cls.field}>
            <Label htmlFor="autodial-campaign-base" className={cls.fieldLabel}>
              {t("autodial.form.base")} *
            </Label>
            <Select
              id="autodial-campaign-base"
              value={draft.base_uid ?? ""}
              error={Boolean(errors.base_uid)}
              aria-describedby={errors.base_uid ? "autodial-campaign-base-error" : undefined}
              onChange={(e) =>
                patch({
                  base_uid: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("autodial.form.basePlaceholder")}</option>
              {(bases ?? []).map((base) => (
                <option key={base.uid} value={base.uid}>
                  {base.name}
                </option>
              ))}
            </Select>
            {errors.base_uid && (
              <Text id="autodial-campaign-base-error" className={cls.error}>
                {t("common.fieldRequired")}
              </Text>
            )}
          </VStack>

          <VStack gap="8" max className={cls.field}>
            <HStack gap="4" align="center">
              <Label htmlFor="autodial-campaign-mode" className={cls.fieldLabel}>
                {t("autodial.form.dialMode")} *
              </Label>
              <InfoTooltip text={t("autodial.form.dialModeHint")} />
            </HStack>
            <Select
              id="autodial-campaign-mode"
              value={draft.dial_mode}
              onChange={(e) =>
                patch({
                  dial_mode: e.target
                    .value as AutodialCampaignDraft["dial_mode"],
                })
              }
            >
              {dialModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </VStack>

          <VStack gap="8" max className={cls.field}>
            <HStack gap="4" align="center">
              <Label htmlFor="autodial-campaign-success" className={cls.fieldLabel}>
                {t("autodial.form.successMinSec")}
              </Label>
              <InfoTooltip text={t("autodial.form.successMinSecHint")} />
            </HStack>
            <Input
              id="autodial-campaign-success"
              type="number"
              min={0}
              className={cls.narrowInput}
              value={draft.success_min_sec}
              onChange={(e) =>
                patch({ success_min_sec: Number(e.target.value) || 0 })
              }
            />
          </VStack>

          <VStack gap="8" max className={cls.field}>
            <Label htmlFor="autodial-campaign-timeout" className={cls.fieldLabel}>
              {t("autodial.form.dialTimeout")}
            </Label>
            <Input
              id="autodial-campaign-timeout"
              type="number"
              min={5}
              className={cls.narrowInput}
              value={draft.dial_timeout_sec}
              onChange={(e) =>
                patch({ dial_timeout_sec: Number(e.target.value) || 0 })
              }
            />
          </VStack>
        </div>

        <VStack gap="8" max>
          <HStack gap="4" align="center">
            <Text className={cls.sectionTitle}>{t("autodial.amd.title")}</Text>
            <InfoTooltip text={t("autodial.amd.hint")} />
          </HStack>
          <div className={cls.grid}>
            <VStack gap="8" max className={cls.field}>
              <Label htmlFor="autodial-amd-enabled" className={cls.fieldLabel}>
                {t("autodial.amd.enabled")}
              </Label>
              <Select
                id="autodial-amd-enabled"
                value={draft.amd.enabled ? "on" : "off"}
                onChange={(e) =>
                  patch({
                    amd: { ...draft.amd, enabled: e.target.value === "on" },
                  })
                }
                className={cls.narrowInput}
              >
                <option value="off">{t("common.disabled")}</option>
                <option value="on">{t("common.enabled")}</option>
              </Select>
            </VStack>
            <VStack gap="8" max className={cls.field}>
              <HStack gap="4" align="center">
                <Label htmlFor="autodial-amd-action" className={cls.fieldLabel}>
                  {t("autodial.amd.onMachine")}
                </Label>
                <InfoTooltip text={t("autodial.amd.onMachineHint")} />
              </HStack>
              <Select
                id="autodial-amd-action"
                value={draft.amd.on_machine}
                disabled={!draft.amd.enabled}
                onChange={(e) =>
                  patch({
                    amd: {
                      ...draft.amd,
                      on_machine: e.target
                        .value as AutodialCampaignDraft["amd"]["on_machine"],
                    },
                  })
                }
              >
                <option value="hangup">{t("autodial.amd.hangup")}</option>
                <option value="continue">{t("autodial.amd.continue")}</option>
                <option value="voicemail">{t("autodial.amd.voicemail")}</option>
              </Select>
            </VStack>
            {draft.amd.enabled && draft.amd.on_machine === "voicemail" && (
              <VStack gap="8" max className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="autodial-amd-prompt" className={cls.fieldLabel}>
                    {t("autodial.amd.messagePrompt")} *
                  </Label>
                  <InfoTooltip text={t("autodial.amd.messagePromptHint")} />
                </HStack>
                <Select
                  id="autodial-amd-prompt"
                  value={draft.amd.message_prompt ?? ""}
                  aria-invalid={Boolean(errors.amd) || undefined}
                  aria-describedby={errors.amd ? "autodial-amd-prompt-error" : undefined}
                  onChange={(e) =>
                    patch({
                      amd: {
                        ...draft.amd,
                        message_prompt: e.target.value || null,
                      },
                    })
                  }
                >
                  <option value="">{t("autodial.amd.messagePromptPlaceholder")}</option>
                  {(prompts ?? []).map((prompt) => (
                    <option key={prompt.uid} value={prompt.filename}>
                      {prompt.comment || prompt.filename}
                    </option>
                  ))}
                </Select>
                {errors.amd === "messageRequired" && (
                  <Text id="autodial-amd-prompt-error" className={cls.error}>
                    {t("autodial.amd.messageRequired")}
                  </Text>
                )}
              </VStack>
            )}
          </div>
        </VStack>
      </VStack>
    );
  },
);

CampaignGeneralTab.displayName = "CampaignGeneralTab";
