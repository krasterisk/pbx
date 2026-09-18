import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type {
  IAutodialPacingConfig,
  IAutodialPredictiveConfig,
} from "@krasterisk/shared";
import {
  InfoTooltip,
  Input,
  Label,
  MultiSelect,
  Select,
  TableRowAction,
  TableRowActions,
  Text,
} from "@/shared/ui";
import { HStack, VStack } from "@/shared/ui/Stack";
import { useGetQueuesQuery } from "@/shared/api/endpoints/queueApi";
import type {
  AutodialCampaignDraft,
  CampaignDraftErrors,
} from "../../model/campaignDraft";
import cls from "./CampaignTabs.module.scss";

type Provider = IAutodialPacingConfig["providers"][number];
type ProviderType = Provider["type"];

const PROVIDER_TYPES: ProviderType[] = [
  "static",
  "queue_agents",
  "trunk_channels",
  "tenant_cap",
];

const DEFAULT_PREDICTIVE: IAutodialPredictiveConfig = {
  target_abandon_pct: 3,
  max_over_dial: 2,
  min_samples: 20,
};

function blankProvider(type: ProviderType): Provider {
  switch (type) {
    case "queue_agents":
      return { type: "queue_agents", queue_names: [] };
    case "trunk_channels":
      return { type: "trunk_channels" };
    case "tenant_cap":
      return { type: "tenant_cap", max_channels: 30 };
    default:
      return { type: "static", max_channels: 2 };
  }
}

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
  errors: CampaignDraftErrors;
}

/**
 * The dialer takes the minimum across every provider, so each row here can only
 * ever slow dialing down — never raise it above another provider's ceiling.
 */
export const CampaignPacingTab = memo(({ draft, onChange, errors }: Props) => {
  const { t } = useTranslation();
  const { data: queues } = useGetQueuesQuery();

  const setProviders = (providers: Provider[]) =>
    onChange({ ...draft, pacing: { ...draft.pacing, providers } });

  const predictive = draft.pacing.predictive ?? DEFAULT_PREDICTIVE;
  const setPredictive = (patch: Partial<IAutodialPredictiveConfig>) =>
    onChange({
      ...draft,
      pacing: { ...draft.pacing, predictive: { ...predictive, ...patch } },
    });

  const updateProvider = (index: number, next: Provider) =>
    setProviders(
      draft.pacing.providers.map((p, i) => (i === index ? next : p)),
    );

  const usedTypes = new Set(draft.pacing.providers.map((p) => p.type));
  const addableTypes = PROVIDER_TYPES.filter((type) => !usedTypes.has(type));

  return (
    <VStack gap="16" max>
      <HStack gap="4" align="center">
        <Text className={cls.sectionTitle}>{t("autodial.pacing.title")}</Text>
        <InfoTooltip text={t("autodial.pacing.intro")} />
      </HStack>

      {draft.dial_mode === "power" && (
        <VStack gap="4" className={cls.field}>
          <HStack gap="4" align="center">
            <Label htmlFor="autodial-power-ratio">
              {t("autodial.pacing.powerRatio")}
            </Label>
            <InfoTooltip text={t("autodial.pacing.powerRatioHint")} />
          </HStack>
          <Input
            id="autodial-power-ratio"
            type="number"
            min={1}
            step="0.1"
            className={cls.narrowInput}
            value={draft.pacing.power_ratio ?? 2}
            onChange={(e) =>
              onChange({
                ...draft,
                pacing: {
                  ...draft.pacing,
                  power_ratio: Number(e.target.value) || 1,
                },
              })
            }
          />
        </VStack>
      )}

      {draft.dial_mode === "predictive" && (
        <VStack gap="8" max>
          <HStack gap="4" align="center">
            <Text className={cls.sectionTitle}>
              {t("autodial.pacing.predictive.title")}
            </Text>
            <InfoTooltip
              text={`${t("autodial.pacing.predictive.intro")}\n${t("autodial.pacing.predictive.hint")}`}
            />
          </HStack>
          <HStack gap="12" align="end" wrap="wrap">
            <VStack gap="4" className={cls.field}>
              <Label htmlFor="autodial-predictive-target">
                {t("autodial.pacing.predictive.targetAbandon")}
              </Label>
              <Input
                id="autodial-predictive-target"
                type="number"
                min={0}
                max={20}
                step="0.5"
                className={cls.narrowInput}
                aria-invalid={Boolean(errors.predictive) || undefined}
                value={predictive.target_abandon_pct}
                onChange={(e) =>
                  setPredictive({
                    target_abandon_pct: Number(e.target.value) || 0,
                  })
                }
              />
            </VStack>
            <VStack gap="4" className={cls.field}>
              <Label htmlFor="autodial-predictive-max">
                {t("autodial.pacing.predictive.maxOverDial")}
              </Label>
              <Input
                id="autodial-predictive-max"
                type="number"
                min={1}
                max={5}
                step="0.1"
                className={cls.narrowInput}
                aria-invalid={Boolean(errors.predictive) || undefined}
                value={predictive.max_over_dial}
                onChange={(e) =>
                  setPredictive({ max_over_dial: Number(e.target.value) || 1 })
                }
              />
            </VStack>
            <VStack gap="4" className={cls.field}>
              <Label htmlFor="autodial-predictive-samples">
                {t("autodial.pacing.predictive.minSamples")}
              </Label>
              <Input
                id="autodial-predictive-samples"
                type="number"
                min={1}
                className={cls.narrowInput}
                value={predictive.min_samples}
                onChange={(e) =>
                  setPredictive({ min_samples: Number(e.target.value) || 1 })
                }
              />
            </VStack>
          </HStack>
          {errors.predictive === "queueAgentsRequired" && (
            <Text className={cls.error}>
              {t("autodial.pacing.predictive.needsQueueAgents")}
            </Text>
          )}
          {errors.predictive === "range" && (
            <Text className={cls.error}>
              {t("autodial.pacing.predictive.rangeError")}
            </Text>
          )}
        </VStack>
      )}

      <VStack gap="8" max>
        {draft.pacing.providers.map((provider, index) => (
          <HStack
            key={provider.type}
            gap="12"
            align="end"
            max
            wrap="wrap"
            className={cls.row}
          >
            <VStack gap="4" className={cls.field}>
              <HStack gap="4" align="center">
                <Label>{t(`autodial.pacing.provider.${provider.type}`)}</Label>
                <InfoTooltip
                  text={t(`autodial.pacing.providerHint.${provider.type}`)}
                />
              </HStack>
            </VStack>

            {(provider.type === "static" || provider.type === "tenant_cap") && (
              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-pacing-max-${provider.type}`}>
                  {t("autodial.pacing.maxChannels")}
                </Label>
                <Input
                  id={`autodial-pacing-max-${provider.type}`}
                  type="number"
                  min={1}
                  className={cls.narrowInput}
                  value={provider.max_channels}
                  onChange={(e) =>
                    updateProvider(index, {
                      ...provider,
                      max_channels: Number(e.target.value) || 1,
                    })
                  }
                />
              </VStack>
            )}

            {provider.type === "queue_agents" && (
              <VStack gap="4" className={cls.field}>
                <Label>{t("autodial.pacing.queues")}</Label>
                <MultiSelect
                  options={(queues ?? []).map((queue) => ({
                    value: queue.name,
                    label: queue.name,
                  }))}
                  value={provider.queue_names}
                  onChange={(queue_names) =>
                    updateProvider(index, { ...provider, queue_names })
                  }
                  placeholder={t("autodial.form.queuesPlaceholder")}
                />
              </VStack>
            )}

            <TableRowActions>
              <TableRowAction
                danger
                title={t("common.delete")}
                aria-label={t("common.delete")}
                onClick={() =>
                  setProviders(
                    draft.pacing.providers.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          </HStack>
        ))}

        {errors.pacing && (
          <Text className={cls.error}>{t("autodial.pacing.atLeastOne")}</Text>
        )}
      </VStack>

      {addableTypes.length > 0 && (
        <HStack gap="8" align="center">
          <Select
            id="autodial-pacing-add"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setProviders([
                ...draft.pacing.providers,
                blankProvider(e.target.value as ProviderType),
              ]);
            }}
            className={cls.narrowInput}
          >
            <option value="">{t("autodial.pacing.addProvider")}</option>
            {addableTypes.map((type) => (
              <option key={type} value={type}>
                {t(`autodial.pacing.provider.${type}`)}
              </option>
            ))}
          </Select>
          <Plus size={16} />
        </HStack>
      )}

      <VStack gap="8" max>
        <HStack gap="4" align="center">
          <Text className={cls.sectionTitle}>{t("autodial.amd.title")}</Text>
          <InfoTooltip text={t("autodial.amd.hint")} />
        </HStack>
        <HStack gap="12" align="end" wrap="wrap">
          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-amd-enabled">
              {t("autodial.amd.enabled")}
            </Label>
            <Select
              id="autodial-amd-enabled"
              value={draft.amd.enabled ? "on" : "off"}
              onChange={(e) =>
                onChange({
                  ...draft,
                  amd: { ...draft.amd, enabled: e.target.value === "on" },
                })
              }
              className={cls.narrowInput}
            >
              <option value="off">{t("common.disabled")}</option>
              <option value="on">{t("common.enabled")}</option>
            </Select>
          </VStack>
          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-amd-action">
              {t("autodial.amd.onMachine")}
            </Label>
            <Select
              id="autodial-amd-action"
              value={draft.amd.on_machine}
              disabled={!draft.amd.enabled}
              onChange={(e) =>
                onChange({
                  ...draft,
                  amd: {
                    ...draft.amd,
                    on_machine: e.target
                      .value as AutodialCampaignDraft["amd"]["on_machine"],
                  },
                })
              }
              className={cls.narrowInput}
            >
              <option value="hangup">{t("autodial.amd.hangup")}</option>
              <option value="continue">{t("autodial.amd.continue")}</option>
              <option value="voicemail" disabled>
                {t("autodial.amd.voicemailUnavailable")}
              </option>
            </Select>
          </VStack>
        </HStack>
      </VStack>
    </VStack>
  );
});

CampaignPacingTab.displayName = "CampaignPacingTab";
