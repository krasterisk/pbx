import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type { AutodialDncScope } from "@krasterisk/shared";
import {
  Button,
  InfoTooltip,
  Input,
  Label,
  Select,
  TableRowAction,
  TableRowActions,
  Text,
} from "@/shared/ui";
import { HStack, VStack } from "@/shared/ui/Stack";
import {
  useCreateAutodialDncMutation,
  useDeleteAutodialDncMutation,
  useGetAutodialDncQuery,
} from "@/shared/api/endpoints/autodialApi";
import cls from "../CampaignFormModal/CampaignTabs.module.scss";

interface Props {
  /** Campaign or base uid that scoped rows belong to. Omit for global-only. */
  scopeUid?: number | null;
  /** Extra scope besides global (campaign | base). */
  scopedAs?: Exclude<AutodialDncScope, "global">;
}

/**
 * Shared stop-list editor: global rows plus optional campaign/base rows.
 * Hours of day stay on the schedule tab — this is only the number list.
 */
export const DncPanel = memo(({ scopeUid, scopedAs }: Props) => {
  const { t } = useTranslation();
  const { data: entries, isFetching } = useGetAutodialDncQuery();
  const [createDnc, { isLoading: isCreating }] = useCreateAutodialDncMutation();
  const [deleteDnc] = useDeleteAutodialDncMutation();

  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<AutodialDncScope>("global");
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    return (entries ?? []).filter((row) => {
      if (row.scope === "global") return true;
      if (!scopedAs || scopeUid == null) return false;
      return row.scope === scopedAs && row.scope_uid === scopeUid;
    });
  }, [entries, scopedAs, scopeUid]);

  const onAdd = async () => {
    setError(null);
    if (!phone.trim()) {
      setError(t("autodial.dnc.phoneRequired"));
      return;
    }
    if (scope !== "global" && scopeUid == null) {
      setError(
        scopedAs === "base"
          ? t("autodial.dnc.saveBaseFirst")
          : t("autodial.dnc.saveCampaignFirst"),
      );
      return;
    }
    try {
      await createDnc({
        scope,
        scope_uid: scope === "global" ? null : scopeUid,
        normalized_phone: phone.trim(),
        reason: reason.trim() || undefined,
        source: "manual",
      }).unwrap();
      setPhone("");
      setReason("");
    } catch {
      setError(t("autodial.dnc.addFailed"));
    }
  };

  return (
    <VStack gap="16" max>
      <HStack gap="4" align="center">
        <Text className={cls.sectionTitle}>{t("autodial.dnc.title")}</Text>
        <InfoTooltip text={t("autodial.dnc.intro")} />
      </HStack>

      <HStack gap="8" align="end" wrap="wrap">
        <VStack gap="4" className={cls.field}>
          <Label htmlFor="autodial-dnc-phone">{t("autodial.dnc.phone")}</Label>
          <Input
            id="autodial-dnc-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="79001234567"
          />
        </VStack>
        <VStack gap="4" className={cls.field}>
          <Label htmlFor="autodial-dnc-reason">
            {t("autodial.dnc.reason")}
          </Label>
          <Input
            id="autodial-dnc-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </VStack>
        {scopedAs && (
          <VStack gap="4" className={cls.field}>
            <HStack gap="4" align="center">
              <Label htmlFor="autodial-dnc-scope">
                {t("autodial.dnc.scope")}
              </Label>
              <InfoTooltip text={t("autodial.dnc.scopeHint")} />
            </HStack>
            <Select
              id="autodial-dnc-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as AutodialDncScope)}
              className={cls.narrowInput}
            >
              <option value="global">{t("autodial.dnc.scopeGlobal")}</option>
              <option value={scopedAs}>
                {scopedAs === "campaign"
                  ? t("autodial.dnc.scopeCampaign")
                  : t("autodial.dnc.scopeBase")}
              </option>
            </Select>
          </VStack>
        )}
        <Button disabled={isCreating} onClick={() => void onAdd()}>
          <Plus size={16} />
          {t("autodial.dnc.add")}
        </Button>
      </HStack>
      {error && <Text className={cls.error}>{error}</Text>}

      <VStack gap="8" max>
        {visible.length === 0 && !isFetching && (
          <Text className={cls.hint}>{t("autodial.dnc.empty")}</Text>
        )}
        {visible.map((row) => (
          <HStack key={row.uid} gap="12" align="center" max className={cls.row}>
            <VStack gap="2" className={cls.field}>
              <Text>{row.normalized_phone}</Text>
              <Text className={cls.hint}>
                {row.scope === "global"
                  ? t("autodial.dnc.scopeGlobal")
                  : row.scope === "campaign"
                    ? t("autodial.dnc.scopeCampaign")
                    : t("autodial.dnc.scopeBase")}
                {row.reason ? ` · ${row.reason}` : ""}
              </Text>
            </VStack>
            <TableRowActions>
              <TableRowAction
                danger
                title={t("common.delete")}
                aria-label={t("common.delete")}
                onClick={() => void deleteDnc(row.uid)}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
});

DncPanel.displayName = "DncPanel";
