import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type {
  AutodialCallerIdPoolPick,
  AutodialCallerIdSource,
  IAutodialTrunkPoolItem,
} from "@krasterisk/shared";
import {
  Button,
  InfoTooltip,
  Input,
  Label,
  Select,
  TagInput,
  TableRowAction,
  TableRowActions,
  Text,
} from "@/shared/ui";
import { HStack, VStack } from "@/shared/ui/Stack";
import { useGetTrunksQuery } from "@/shared/api/endpoints/trunkApi";
import { useGetDirectoriesQuery, useGetDirectoryQuery } from "@/shared/api/endpoints/directoryApi";
import { useGetAutodialBaseQuery } from "@/shared/api/endpoints/autodialApi";
import type {
  AutodialCampaignDraft,
  CampaignDraftErrors,
} from "../../model/campaignDraft";
import cls from "./CampaignTabs.module.scss";

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
  errors: CampaignDraftErrors;
}

function callerIdSourceOf(item: IAutodialTrunkPoolItem): AutodialCallerIdSource {
  return item.caller_id_source ?? { mode: "static", value: item.caller_id ?? "" };
}

function cleanPoolNumber(value: string): string {
  return value.replace(/[|;]/g, "").trim();
}

function TrunkCallerIdEditor({
  item,
  index,
  baseUid,
  onChange,
}: {
  item: IAutodialTrunkPoolItem;
  index: number;
  baseUid: number | null;
  onChange: (next: IAutodialTrunkPoolItem) => void;
}) {
  const { t } = useTranslation();
  const source = callerIdSourceOf(item);
  const { data: directories, isLoading: isDirectoriesLoading } = useGetDirectoriesQuery(undefined, {
    skip: source.mode !== "directory",
  });
  const { data: base } = useGetAutodialBaseQuery(baseUid as number, { skip: !baseUid });
  const directoryUid = source.mode === "directory" ? source.directory_uid : 0;
  const { data: directory, isLoading: isDirectoryLoading } = useGetDirectoryQuery(directoryUid, {
    skip: !directoryUid,
  });
  const mode = source.mode;
  const setSource = (caller_id_source: AutodialCallerIdSource) =>
    onChange({ ...item, caller_id_source });
  const updateFallback = (caller_id: string) => onChange({ ...item, caller_id });

  return (
    <div className={cls.cidEditor}>
      <VStack gap="8" max className={cls.cidModeField}>
        <HStack gap="4" align="center">
          <Label htmlFor={`autodial-cid-mode-${index}`} className={cls.fieldLabel}>
            {t("autodial.trunks.callerIdSource")}
          </Label>
          <InfoTooltip text={t("autodial.trunks.callerIdSourceHint")} />
        </HStack>
        <Select
          id={`autodial-cid-mode-${index}`}
          value={mode}
          onChange={(event) => {
            switch (event.target.value) {
              case "pool":
                setSource({ mode: "pool", numbers: [], pick: "round_robin" });
                return;
              case "directory":
                setSource({
                  mode: "directory",
                  directory_uid: 0,
                  value_field_uid: 0,
                  key: { source: "autodial_field", field_key: "" },
                  on_missing: "fallback",
                });
                return;
              default:
                setSource({ mode: "static", value: source.mode === "static" ? source.value : "" });
            }
          }}
        >
          <option value="static">{t("autodial.trunks.callerIdStatic")}</option>
          <option value="pool">{t("autodial.trunks.callerIdPool")}</option>
          <option value="directory">{t("autodial.trunks.callerIdDirectory")}</option>
        </Select>
      </VStack>

      {source.mode === "static" && (
        <VStack gap="8" max className={cls.cidValueField}>
          <Label htmlFor={`autodial-trunk-cid-${index}`} className={cls.fieldLabel}>
            {t("autodial.trunks.callerId")}
          </Label>
          <Input
            id={`autodial-trunk-cid-${index}`}
            value={source.value ?? ""}
            placeholder="74950000000"
            onChange={(event) => setSource({ mode: "static", value: event.target.value })}
          />
        </VStack>
      )}

      {source.mode === "pool" && (
        <VStack gap="8" max className={cls.cidValueField}>
          <Label className={cls.fieldLabel}>{t("autodial.trunks.callerIdPoolNumbers")}</Label>
          <TagInput
            value={source.numbers}
            onChange={(numbers) =>
              setSource({
                mode: "pool",
                numbers: numbers.map(cleanPoolNumber).filter(Boolean),
                pick: source.pick,
              })
            }
            placeholder={t("autodial.trunks.callerIdPoolAdd")}
            aria-label={t("autodial.trunks.callerIdPoolNumbers")}
          />
          <VStack gap="8" max>
            <Label htmlFor={`autodial-cid-pick-${index}`} className={cls.fieldLabel}>
              {t("autodial.trunks.callerIdPoolPick")}
            </Label>
            <Select
              id={`autodial-cid-pick-${index}`}
              value={source.pick}
              onChange={(event) =>
                setSource({
                  mode: "pool",
                  numbers: source.numbers,
                  pick: event.target.value as AutodialCallerIdPoolPick,
                })
              }
            >
              <option value="round_robin">{t("autodial.trunks.callerIdPoolRoundRobin")}</option>
              <option value="random">{t("autodial.trunks.callerIdPoolRandom")}</option>
            </Select>
          </VStack>
        </VStack>
      )}

      {source.mode === "directory" && (
        <div className={cls.cidDirectoryGrid}>
          <VStack gap="8" max className={cls.field}>
            <HStack gap="4" align="center">
              <Label htmlFor={`autodial-cid-directory-${index}`} className={cls.fieldLabel}>
                {t("autodial.trunks.callerIdDirectoryLabel")}
              </Label>
              <InfoTooltip text={t("autodial.trunks.callerIdDirectoryHint")} />
            </HStack>
            <Select
              id={`autodial-cid-directory-${index}`}
              value={source.directory_uid ? String(source.directory_uid) : ""}
              disabled={isDirectoriesLoading}
              onChange={(event) =>
                setSource({
                  ...source,
                  directory_uid: Number(event.target.value) || 0,
                  value_field_uid: 0,
                })
              }
            >
              <option value="">{t("autodial.trunks.selectDirectory")}</option>
              {(directories ?? []).map((directory) => (
                <option key={directory.uid} value={directory.uid}>
                  {directory.name}
                </option>
              ))}
            </Select>
          </VStack>
          <VStack gap="8" max className={cls.field}>
            <Label htmlFor={`autodial-cid-key-${index}`} className={cls.fieldLabel}>
              {t("autodial.trunks.callerIdDirectoryKey")}
            </Label>
            <Select
              id={`autodial-cid-key-${index}`}
              value={source.key.field_key}
              disabled={!baseUid}
              onChange={(event) => setSource({ ...source, key: { source: "autodial_field", field_key: event.target.value } })}
            >
              <option value="">{t("autodial.trunks.selectContactField")}</option>
              {(base?.fields ?? []).map((field) => (
                <option key={field.uid} value={field.key}>{field.label || field.key}</option>
              ))}
            </Select>
          </VStack>
          <VStack gap="8" max className={cls.field}>
            <Label htmlFor={`autodial-cid-directory-field-${index}`} className={cls.fieldLabel}>
              {t("autodial.trunks.callerIdDirectoryValue")}
            </Label>
            <Select
              id={`autodial-cid-directory-field-${index}`}
              value={source.value_field_uid ? String(source.value_field_uid) : ""}
              disabled={!source.directory_uid || isDirectoryLoading}
              onChange={(event) => setSource({ ...source, value_field_uid: Number(event.target.value) || 0 })}
            >
              <option value="">{t("autodial.trunks.selectDirectoryField")}</option>
              {(directory?.fields ?? [])
                .filter((field) => field.type === "phone" || field.type === "string")
                .map((field) => (
                  <option key={field.uid} value={field.uid}>{field.label || field.key}</option>
                ))}
            </Select>
          </VStack>
          <VStack gap="8" max className={cls.field}>
            <HStack gap="4" align="center">
              <Label htmlFor={`autodial-cid-fallback-${index}`} className={cls.fieldLabel}>
                {t("autodial.trunks.callerIdFallback")}
              </Label>
              <InfoTooltip text={t("autodial.trunks.callerIdFallbackHint")} />
            </HStack>
            <Input
              id={`autodial-cid-fallback-${index}`}
              value={item.caller_id ?? ""}
              placeholder={t("autodial.trunks.callerIdFallbackPlaceholder")}
              onChange={(event) => updateFallback(event.target.value)}
            />
          </VStack>
        </div>
      )}
    </div>
  );
}

export const CampaignTrunksTab = memo(({ draft, onChange, errors }: Props) => {
  const { t } = useTranslation();
  const { data: trunks } = useGetTrunksQuery();

  const setPool = (trunk_pool: IAutodialTrunkPoolItem[]) =>
    onChange({ ...draft, trunk_pool });
  const updateItem = (index: number, next: IAutodialTrunkPoolItem) =>
    setPool(draft.trunk_pool.map((item, i) => (i === index ? next : item)));

  const addTrunk = () => {
    const firstFree = (trunks ?? []).find(
      (trunk) => !draft.trunk_pool.some((item) => item.trunk_id === trunk.id),
    );
    setPool([
      ...draft.trunk_pool,
      {
        trunk_id: firstFree?.id ?? "",
        caller_id_source: { mode: "static", value: "" },
        weight: 1,
        max_channels: 0,
      },
    ]);
  };

  return (
    <VStack gap="16" max>
      <HStack gap="4" align="center">
        <Text className={cls.sectionTitle}>{t("autodial.trunks.title")}</Text>
        <InfoTooltip text={t("autodial.trunks.intro")} />
      </HStack>

      <VStack gap="8" max>
        {draft.trunk_pool.map((item, index) => (
          <div key={`${item.trunk_id}-${index}`} className={cls.row}>
            <div className={cls.rowGrid}>
              <VStack gap="8" max className={cls.field}>
                <Label htmlFor={`autodial-trunk-${index}`} className={cls.fieldLabel}>
                  {t("autodial.trunks.trunk")}
                </Label>
                <Select
                  id={`autodial-trunk-${index}`}
                  value={item.trunk_id}
                  onChange={(e) =>
                    updateItem(index, { ...item, trunk_id: e.target.value })
                  }
                >
                  <option value="">{t("autodial.trunks.selectTrunk")}</option>
                  {(trunks ?? []).map((trunk) => (
                    <option key={trunk.id} value={trunk.id}>
                      {trunk.name || trunk.id}
                    </option>
                  ))}
                </Select>
              </VStack>

              <VStack gap="8" max className={cls.field}>
                <Label htmlFor={`autodial-trunk-weight-${index}`} className={cls.fieldLabel}>
                  {t("autodial.trunks.weight")}
                </Label>
                <Input
                  id={`autodial-trunk-weight-${index}`}
                  type="number"
                  min={1}
                  value={item.weight ?? 1}
                  onChange={(e) =>
                    updateItem(index, {
                      ...item,
                      weight: Number(e.target.value) || 1,
                    })
                  }
                />
              </VStack>

              <VStack gap="8" max className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor={`autodial-trunk-max-${index}`} className={cls.fieldLabel}>
                    {t("autodial.trunks.maxChannels")}
                  </Label>
                  <InfoTooltip text={t("autodial.trunks.maxChannelsHint")} />
                </HStack>
                <Input
                  id={`autodial-trunk-max-${index}`}
                  type="number"
                  min={0}
                  value={item.max_channels ?? 0}
                  placeholder={String(
                    (trunks ?? []).find((trunk) => trunk.id === item.trunk_id)
                      ?.maxChannels || "",
                  )}
                  onChange={(e) =>
                    updateItem(index, {
                      ...item,
                      max_channels: Number(e.target.value) || 0,
                    })
                  }
                />
              </VStack>

              <TableRowActions>
                <TableRowAction
                  danger
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                  onClick={() =>
                    setPool(draft.trunk_pool.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 />
                </TableRowAction>
              </TableRowActions>
            </div>
            <TrunkCallerIdEditor
              item={item}
              index={index}
              baseUid={draft.base_uid}
              onChange={(next) => updateItem(index, next)}
            />
          </div>
        ))}
      </VStack>

      {errors.trunk_pool && (
        <Text className={cls.error}>{t("autodial.trunks.atLeastOne")}</Text>
      )}

      <HStack gap="8">
        <Button variant="outline" onClick={addTrunk}>
          <Plus size={16} />
          {t("autodial.trunks.add")}
        </Button>
      </HStack>

      {draft.cid_policy.mode !== "per_trunk" && draft.trunk_pool.some((item) => !item.caller_id_source) && (
        <Text className={cls.warning}>{t("autodial.trunks.legacyCallerIdWarning")}</Text>
      )}
    </VStack>
  );
});

CampaignTrunksTab.displayName = "CampaignTrunksTab";
