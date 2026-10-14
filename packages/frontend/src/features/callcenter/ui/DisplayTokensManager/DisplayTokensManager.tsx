import { UserLevel, selectUserLevel } from "@/entities/User";
import {
  useCreateDisplayTokenMutation,
  useListDisplayTokensQuery,
  useRevokeDisplayTokenMutation,
  type IDisplayToken,
} from "@/shared/api/endpoints/callCenterApi";
import { useAppSelector } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectionCell,
  Text,
} from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Copy, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import styles from "./DisplayTokensManager.module.scss";

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function wallboardUrl(token: string): string {
  return `${window.location.origin}/callcenter/wallboard?token=${encodeURIComponent(token)}`;
}

/**
 * Supervisor tab: create / copy / revoke TV display-token links (D-26 UI).
 */
export function DisplayTokensManager() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const isSupervisor =
    level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;

  const {
    data: tokens = [],
    isLoading,
    isError,
    refetch,
  } = useListDisplayTokensQuery(undefined, {
    skip: !isSupervisor,
  });
  const [createToken, { isLoading: isCreating }] =
    useCreateDisplayTokenMutation();
  const [revokeToken, { isLoading: isRevoking }] =
    useRevokeDisplayTokenMutation();

  const [label, setLabel] = useState("");
  const [expiresDays, setExpiresDays] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IDisplayToken[] | null>(
    null,
  );
  const selection = useCrossPageRowSelection({ globalFilter: "" });
  const selectedTokens = tokens.filter(
    (row) => selection.rowSelection[String(row.uid)],
  );
  const activeSelected = selectedTokens.filter((row) => !row.revoked_at);

  const sorted = useMemo(
    () =>
      [...tokens].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      ),
    [tokens],
  );

  if (!isSupervisor) {
    return (
      <div className={styles.denied}>
        <Text>
          {t("callcenter.settings.displayTokens.denied", "Недостаточно прав")}
        </Text>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.skeletonWrap}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        message={t("callcenter.settings.loadError")}
        onRetry={() => refetch()}
        retryLabel={t("callcenter.settings.retry")}
      />
    );
  }

  const handleCreate = async () => {
    try {
      const days = expiresDays.trim() ? Number(expiresDays) : undefined;
      const row = await createToken({
        label: label.trim() || undefined,
        expires_in_days:
          days != null && Number.isFinite(days) && days >= 1 ? days : undefined,
      }).unwrap();
      const url = wallboardUrl(row.token);
      setCreatedUrl(url);
      setLabel("");
      setExpiresDays("");
      toast.success(
        t("callcenter.settings.displayTokens.created", "Ссылка создана"),
      );
    } catch {
      toast.error(t("common.error", "Ошибка сохранения"));
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        t("callcenter.settings.displayTokens.copied", "Ссылка скопирована"),
      );
    } catch {
      toast.error(t("common.error", "Ошибка копирования"));
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      for (const token of revokeTarget) await revokeToken(token.uid).unwrap();
      selection.clearSelection();
      setRevokeTarget(null);
      toast.success(
        t("callcenter.settings.displayTokens.revoked", "Ссылка отозвана"),
      );
    } catch {
      toast.error(t("common.error", "Ошибка сохранения"));
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Text className={styles.title}>
          {t("callcenter.settings.displayTokens.title", "Display-токены")}
        </Text>
        <Text className={styles.hint}>
          {t(
            "callcenter.settings.displayTokens.hint",
            "Долгоживущие ссылки для TV wallboard без логина. Токен показывается один раз при создании.",
          )}
        </Text>
      </div>

      <div className={styles.createRow}>
        <div className={styles.field}>
          <Label htmlFor="dt-label">
            {t("callcenter.settings.displayTokens.label", "Метка")}
          </Label>
          <Input
            id="dt-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t(
              "callcenter.settings.displayTokens.labelPh",
              "Приёмная TV",
            )}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="dt-expires">
            {t("callcenter.settings.displayTokens.expiresDays", "Срок (дней)")}
          </Label>
          <Input
            id="dt-expires"
            type="number"
            min={1}
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value)}
            placeholder={t(
              "callcenter.settings.displayTokens.expiresPh",
              "пусто = без срока",
            )}
          />
        </div>
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isCreating}
        >
          <Link2 className="w-4 h-4 mr-1.5" />
          {t(
            "callcenter.settings.displayTokens.create",
            "Создать ссылку для TV",
          )}
        </Button>
      </div>

      {createdUrl && (
        <div className={styles.onceCard}>
          <Text className={styles.onceTitle}>
            {t(
              "callcenter.settings.displayTokens.onceHint",
              "Ссылка готова. Скопируйте её сейчас - токен больше не показывается отдельно.",
            )}
          </Text>
          <div className={styles.onceRow}>
            <code className={styles.url}>{createdUrl}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopy(createdUrl)}
            >
              <Copy className="w-4 h-4 mr-1" />
              {t("callcenter.settings.displayTokens.copy", "Копировать")}
            </Button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <Text>
            {t(
              "callcenter.settings.displayTokens.empty",
              "Ссылок для TV пока нет",
            )}
          </Text>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCreate()}
            disabled={isCreating}
          >
            {t(
              "callcenter.settings.displayTokens.create",
              "Создать ссылку для TV",
            )}
          </Button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <Table
            className={styles.table}
            selectedCount={selection.selectedCount}
            selectedItem={
              selectedTokens.length === 1 ? selectedTokens[0] : undefined
            }
            onCopySelected={() =>
              void handleCopy(wallboardUrl(selectedTokens[0].token))
            }
            canCopySelected={() => !selectedTokens[0]?.revoked_at}
            copyLabel={t(
              "callcenter.settings.displayTokens.copy",
              "Копировать",
            )}
            onDeleteSelected={() => setRevokeTarget(activeSelected)}
            deleteDisabled={isRevoking || !activeSelected.length}
            deleteLabel={t(
              "callcenter.settings.displayTokens.revoke",
              "Отозвать",
            )}
            onClearSelection={selection.clearSelection}
          >
            <TableHeader>
              <TableRow>
                <TableHead exportable={false} />
                <TableHead>
                  {t("callcenter.settings.displayTokens.colLabel", "Метка")}
                </TableHead>
                <TableHead>
                  {t("callcenter.settings.displayTokens.colCreated", "Создан")}
                </TableHead>
                <TableHead>
                  {t(
                    "callcenter.settings.displayTokens.colLastUsed",
                    "Последнее использование",
                  )}
                </TableHead>
                <TableHead>
                  {t("callcenter.settings.displayTokens.colStatus", "Статус")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => {
                const revoked = Boolean(row.revoked_at);
                const url = wallboardUrl(row.token);
                return (
                  <TableRow
                    key={row.uid}
                    className={revoked ? styles.rowRevoked : undefined}
                    data-selected={!!selection.rowSelection[String(row.uid)]}
                  >
                    <TableSelectionCell
                      {...selection.cardSelection(String(row.uid))}
                      label={t("common.selectRowAria", {
                        index: row.label || String(row.uid),
                      })}
                    />
                    <TableCell>
                      {row.label ||
                        t(
                          "callcenter.settings.displayTokens.unnamed",
                          "Без метки",
                        )}
                    </TableCell>
                    <TableCell className={styles.tabular}>
                      {formatDt(row.created_at)}
                    </TableCell>
                    <TableCell className={styles.tabular}>
                      {formatDt(row.last_used_at)}
                    </TableCell>
                    <TableCell>
                      {revoked
                        ? t(
                            "callcenter.settings.displayTokens.statusRevoked",
                            "Отозван",
                          )
                        : t(
                            "callcenter.settings.displayTokens.statusActive",
                            "Активен",
                          )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t(
                "callcenter.settings.displayTokens.revokeTitle",
                "Отозвать ссылку?",
              )}
            </DialogTitle>
          </DialogHeader>
          <Text>
            {t(
              "callcenter.settings.displayTokens.revokeBody",
              "Отозвать ссылку? Wallboard на TV перестанет обновляться",
            )}
          </Text>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokeTarget(null)}
            >
              {t("callcenter.settings.displayTokens.cancel", "Отмена")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isRevoking}
              onClick={() => void handleRevoke()}
            >
              {t("callcenter.settings.displayTokens.revoke", "Отозвать")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
