import { UserLevel, selectUserLevel } from "@/entities/User";
import type { IPauseReason } from "@/features/callcenter/model/types/callCenterSchema";
import {
  useCreatePauseReasonMutation,
  useDeletePauseReasonMutation,
  useGetPauseReasonsQuery,
  useUpdatePauseReasonMutation,
} from "@/shared/api/endpoints/callCenterApi";
import { useAppSelector } from "@/shared/hooks/useAppStore";
import { buildBulkDeletePreview } from "@/shared/lib/tableSelection/bulkDeletePreview";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Flex,
  FormDialogContent,
  Input,
  Label,
  ModalBody,
  ModalSection,
  Skeleton,
  Switch,
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
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import styles from "./PauseReasonsManager.module.scss";

const DEFAULT_COLOR = "#f59e0b";

interface PauseReasonForm {
  name: string;
  color: string;
  max_duration: number;
  is_paid: boolean;
  sort_order: number;
}

const EMPTY_FORM: PauseReasonForm = {
  name: "",
  color: DEFAULT_COLOR,
  max_duration: 0,
  is_paid: false,
  sort_order: 0,
};

/**
 * Settings tab: CRUD for pause reasons catalog (D-40).
 */
export function PauseReasonsManager() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const isSupervisor =
    level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;

  const {
    data: reasons = [],
    isLoading,
    isError,
    refetch,
  } = useGetPauseReasonsQuery(undefined, {
    skip: !isSupervisor,
  });
  const [createReason, { isLoading: isCreating }] =
    useCreatePauseReasonMutation();
  const [updateReason, { isLoading: isUpdating }] =
    useUpdatePauseReasonMutation();
  const [deleteReason, { isLoading: isDeleting }] =
    useDeletePauseReasonMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IPauseReason | null>(null);
  const [form, setForm] = useState<PauseReasonForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<IPauseReason[] | null>(null);
  const selection = useCrossPageRowSelection({ globalFilter: "" });
  const selectedReasons = reasons.filter(
    (row) => selection.rowSelection[String(row.uid)],
  );

  const sorted = useMemo(
    () =>
      [...reasons].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [reasons],
  );

  if (!isSupervisor) {
    return (
      <div className={styles.denied}>
        <Text>
          {t("callcenter.settings.pauseReasons.denied", "Недостаточно прав")}
        </Text>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.skeletonWrap}>
        <Skeleton height="2rem" width="12rem" />
        <Skeleton height="2.5rem" width="100%" />
        <Skeleton height="6rem" width="100%" />
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

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      sort_order:
        sorted.length > 0
          ? Math.max(...sorted.map((r) => r.sort_order ?? 0)) + 1
          : 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (row: IPauseReason) => {
    setEditing(row);
    setForm({
      name: row.name,
      color: row.color || DEFAULT_COLOR,
      max_duration: row.max_duration ?? 0,
      is_paid: Boolean(row.is_paid),
      sort_order: row.sort_order ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error(t("callcenter.pauseReasons.name", "Название"));
      return;
    }
    const payload: Partial<IPauseReason> = {
      name,
      color: form.color || DEFAULT_COLOR,
      max_duration:
        Number.isFinite(form.max_duration) && form.max_duration >= 0
          ? form.max_duration
          : 0,
      is_paid: form.is_paid,
      sort_order: Number.isFinite(form.sort_order) ? form.sort_order : 0,
    };
    try {
      if (editing) {
        await updateReason({ id: editing.uid, data: payload }).unwrap();
      } else {
        await createReason(payload).unwrap();
      }
      setDialogOpen(false);
      toast.success(
        t("callcenter.settings.pauseReasons.saved", "Причина сохранена"),
      );
    } catch {
      toast.error(t("common.error", "Ошибка сохранения"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      for (const row of deleteTarget) await deleteReason(row.uid).unwrap();
      selection.clearSelection();
      setDeleteTarget(null);
      toast.success(
        t("callcenter.settings.pauseReasons.deleted", "Причина удалена"),
      );
    } catch {
      toast.error(t("common.error", "Ошибка сохранения"));
    }
  };

  const formatDuration = (mins: number) => {
    if (!mins || mins <= 0) {
      return t("callcenter.settings.pauseReasons.unlimited", "Без лимита");
    }
    return `${mins} ${t("callcenter.settings.pauseReasons.minutes", "мин")}`;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <Button type="button" onClick={openCreate}>
            <Plus size={16} />
            {t("callcenter.settings.pauseReasons.add", "Добавить причину")}
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <Text>
            {t(
              "callcenter.settings.pauseReasons.empty",
              "Причин пауз пока нет",
            )}
          </Text>
          <Button type="button" variant="outline" onClick={openCreate}>
            {t("callcenter.settings.pauseReasons.add", "Добавить причину")}
          </Button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <Table
            className={styles.table}
            selectedCount={selection.selectedCount}
            onDeleteSelected={() => setDeleteTarget(selectedReasons)}
            deleteDisabled={isDeleting || !selectedReasons.length}
            onClearSelection={selection.clearSelection}
          >
            <TableHeader>
              <TableRow>
                <TableHead exportable={false} />
                <TableHead>
                  {t("callcenter.pauseReasons.name", "Название")}
                </TableHead>
                <TableHead>
                  {t("callcenter.pauseReasons.color", "Цвет")}
                </TableHead>
                <TableHead>
                  {t(
                    "callcenter.pauseReasons.maxDuration",
                    "Макс. длительность (мин)",
                  )}
                </TableHead>
                <TableHead>
                  {t("callcenter.pauseReasons.isPaid", "Оплачиваемая")}
                </TableHead>
                <TableHead>
                  {t("callcenter.pauseReasons.sortOrder", "Порядок")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow
                  onActivate={() => openEdit(row)}
                  key={row.uid}
                  data-selected={!!selection.rowSelection[String(row.uid)]}
                >
                  <TableSelectionCell
                    {...selection.cardSelection(String(row.uid))}
                    label={t("common.selectRowAria", { index: row.name })}
                  />
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Flex
                      as="span"
                      className={styles.swatch}
                      style={{ backgroundColor: row.color || DEFAULT_COLOR }}
                      aria-hidden
                    />
                    <Text as="span" className={styles.tabular}>
                      {row.color || DEFAULT_COLOR}
                    </Text>
                  </TableCell>
                  <TableCell className={styles.tabular}>
                    {formatDuration(row.max_duration)}
                  </TableCell>
                  <TableCell>
                    {row.is_paid
                      ? t("callcenter.pause.paid", "Оплачив.")
                      : t("callcenter.settings.pauseReasons.unpaid", "Нет")}
                  </TableCell>
                  <TableCell className={styles.tabular}>
                    {row.sort_order ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => !open && setDialogOpen(false)}
      >
        <FormDialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("callcenter.pauseReasons.edit", "Редактировать причину")
                : t("callcenter.pauseReasons.add", "Добавить причину")}
            </DialogTitle>
          </DialogHeader>
          <ModalBody>
            <ModalSection title={t("modal.sections.settings")}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <Label htmlFor="pr-name">
                    {t("callcenter.pauseReasons.name", "Название")}
                  </Label>
                  <Input
                    id="pr-name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="pr-color">
                    {t("callcenter.pauseReasons.color", "Цвет")}
                  </Label>
                  <div className={styles.colorRow}>
                    <Input
                      id="pr-color"
                      type="color"
                      className={styles.colorPicker}
                      value={form.color || DEFAULT_COLOR}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color: e.target.value }))
                      }
                    />
                    <Input
                      value={form.color}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color: e.target.value }))
                      }
                      placeholder={DEFAULT_COLOR}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <Label htmlFor="pr-max">
                    {t(
                      "callcenter.pauseReasons.maxDuration",
                      "Макс. длительность (мин)",
                    )}
                  </Label>
                  <Input
                    id="pr-max"
                    type="number"
                    min={0}
                    value={form.max_duration}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setForm((f) => ({
                        ...f,
                        max_duration: Number.isFinite(n) ? Math.max(0, n) : 0,
                      }));
                    }}
                  />
                </div>
                <div className={styles.row}>
                  <Label htmlFor="pr-paid">
                    {t("callcenter.pauseReasons.isPaid", "Оплачиваемая")}
                  </Label>
                  <Switch
                    id="pr-paid"
                    checked={form.is_paid}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, is_paid: checked }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="pr-sort">
                    {t("callcenter.pauseReasons.sortOrder", "Порядок")}
                  </Label>
                  <Input
                    id="pr-sort"
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setForm((f) => ({
                        ...f,
                        sort_order: Number.isFinite(n) ? n : 0,
                      }));
                    }}
                  />
                </div>
              </div>
            </ModalSection>
          </ModalBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t("common.cancel", "Отмена")}
            </Button>
            <Button
              type="button"
              disabled={isCreating || isUpdating}
              onClick={() => void handleSave()}
            >
              {t("callcenter.settings.save")}
            </Button>
          </DialogFooter>
        </FormDialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(
                "callcenter.settings.pauseReasons.deleteTitle",
                "Удалить причину?",
              )}
            </DialogTitle>
          </DialogHeader>
          <Text>
            {(() => {
              const preview = buildBulkDeletePreview({
                labels: (deleteTarget ?? []).map((row) => row.name),
                allMatching: false,
                hasFilter: false,
                filteredTotal: deleteTarget?.length ?? 0,
              });
              return preview.mode === "truncated"
                ? t("common.confirmBulkDeleteBodyMore", {
                    labels: preview.previewLabels.join(", "),
                    remaining: preview.remaining,
                  })
                : t("callcenter.pauseReasons.confirmDelete", {
                    name: preview.previewLabels.join(", "),
                    defaultValue: `Удалить причины паузы «${preview.previewLabels.join(", ")}»?`,
                  });
            })()}
          </Text>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel", "Отмена")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {t("common.delete", "Удалить")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
