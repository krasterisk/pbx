import { TemplateBuilder } from "@/features/callcenter/ui/TemplateBuilder";
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import {
  useDeleteCardTemplateMutation,
  useGetCardTemplatesQuery,
} from "@/shared/api/endpoints/callCenterApi";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import { buildBulkDeletePreview } from "@/shared/lib/tableSelection/bulkDeletePreview";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  HStack,
  QueryErrorState,
  TableCard,
  TableToolbar,
  Text,
  VStack,
} from "@/shared/ui";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import styles from "./CardTemplatesTab.module.scss";

type ViewMode = "list" | "create" | "edit";

export function CardTemplatesTab() {
  const { t } = useTranslation();
  const { data: queues = [] } = useGetQueuesQuery();
  const {
    data: templates = [],
    isLoading,
    isError,
    refetch,
  } = useGetCardTemplatesQuery();
  const [deleteTemplate] = useDeleteCardTemplateMutation();
  const [mode, setMode] = useState<ViewMode>("list");
  const [editId, setEditId] = useState<number | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<
    | {
        id: number;
        name: string;
      }[]
    | null
  >(null);
  const selection = useCrossPageRowSelection({ globalFilter: "" });
  const [deletingSelected, setDeletingSelected] = useState(false);

  const handleDone = useCallback(() => {
    setMode("list");
    setEditId(undefined);
    refetch();
  }, [refetch]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeletingSelected(true);
    try {
      for (const template of confirmDelete)
        await deleteTemplate(template.id).unwrap();
      selection.clearSelection();
      toast.success(t("callcenter.cards.builder.deleted"));
      setConfirmDelete(null);
    } catch {
      toast.error(t("callcenter.cards.builder.deleteError"));
    } finally {
      setDeletingSelected(false);
    }
  }, [confirmDelete, deleteTemplate, t, selection]);

  if (mode === "create") {
    return <TemplateBuilder onDone={handleDone} />;
  }

  if (mode === "edit" && editId) {
    return <TemplateBuilder templateId={editId} onDone={handleDone} />;
  }

  if (isError) return (
    <QueryErrorState
      message={t('callcenter.cards.builder.loadError', 'Could not load card templates. Try again.')}
      onRetry={() => void refetch()}
    />
  );

  const deletePreview = buildBulkDeletePreview({
    labels: (confirmDelete ?? []).map((template) => template.name),
    allMatching: false,
    hasFilter: false,
    filteredTotal: confirmDelete?.length ?? 0,
  });

  return (
    <VStack gap="16" max>
      <HStack justify="end" align="center" max>
        <Button size="sm" onClick={() => setMode("create")}>
          <Plus size={16} />
          {t("callcenter.cards.builder.createTemplate")}
        </Button>
      </HStack>

      <TableToolbar
        selectionRowIds={templates.map((template) => String(template.uid))}
        showSearch={false}
        showExport={false}
        selection={selection}

        deleteDisabled={deletingSelected}
        onDeleteSelected={() =>
          setConfirmDelete(
            templates
              .filter(
                (template) => selection.rowSelection[String(template.uid)],
              )
              .map((template) => ({ id: template.uid, name: template.name })),
          )
        }
      />

      {isLoading ? (
        <Text>{t("common.loading")}</Text>
      ) : templates.length === 0 ? (
        <VStack gap="12" align="center" className={styles.empty}>
          <Text variant="muted">{t("callcenter.cards.builder.empty")}</Text>
          <Button onClick={() => setMode("create")}>
            <Plus size={16} />
            {t("callcenter.cards.builder.createTemplate")}
          </Button>
        </VStack>
      ) : (
        <VStack gap="8" max>
          {templates.map((tpl) => (
            <TableCard
              onActivate={() => {
                setEditId(tpl.uid);
                setMode("edit");
              }}
              direction="row"
              key={tpl.uid}
              selection={selection.cardSelection(
                String(tpl.uid),
                t("common.selectRowAria", { index: tpl.name }),
              )}
              justify="between"
              align="center"
              className={styles.card}
            >
              <VStack gap="4">
                <Text className={styles.name}>{tpl.name}</Text>
                <HStack gap="8" wrap="wrap">
                  <Badge variant={tpl.is_active ? "default" : "secondary"}>
                    {tpl.is_active
                      ? t("callcenter.cards.builder.active")
                      : t("callcenter.cards.builder.inactive")}
                  </Badge>
                  <Badge variant="outline">
                    {t(`callcenter.cards.builder.autoOpen.${tpl.auto_open_on}`)}
                  </Badge>
                  {(tpl.queue_names ?? []).map((q) => (
                    <Badge key={q} variant="secondary">
                      {queueDisplayName(q, queues.map(queue => ({ name: queue.name, displayName: queue.display_name ?? "", exten: queue.exten })))}
                    </Badge>
                  ))}
                </HStack>
              </VStack>
            </TableCard>
          ))}
        </VStack>
      )}

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("callcenter.cards.builder.confirmDelete", {
                name: deletePreview.previewLabels.join(", "),
              })}
            </DialogTitle>
          </DialogHeader>
          {deletePreview.mode === "truncated" ? (
            <Text>
              {t("common.confirmBulkDeleteBodyMore", {
                labels: deletePreview.previewLabels.join(", "),
                remaining: deletePreview.remaining,
              })}
            </Text>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deletingSelected}
              onClick={handleDelete}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
