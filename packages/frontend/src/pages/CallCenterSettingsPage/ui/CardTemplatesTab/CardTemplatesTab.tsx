import { TemplateBuilder } from "@/features/callcenter/ui/TemplateBuilder";
import {
  useDeleteCardTemplateMutation,
  useGetCardTemplatesQuery,
} from "@/shared/api/endpoints/callCenterApi";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  HStack,
  TableCard,
  TableToolbar,
  Text,
  VStack,
} from "@/shared/ui";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

type ViewMode = "list" | "create" | "edit";

export function CardTemplatesTab() {
  const { t } = useTranslation();
  const {
    data: templates = [],
    isLoading,
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
  }, [confirmDelete, deleteTemplate, t, selection.clearSelection]);

  if (mode === "create") {
    return <TemplateBuilder onDone={handleDone} />;
  }

  if (mode === "edit" && editId) {
    return <TemplateBuilder templateId={editId} onDone={handleDone} />;
  }

  return (
    <VStack gap="16" className="w-full">
      <HStack justify="between" align="center" className="w-full">
        <Text className="font-medium">
          {t("callcenter.cards.builder.listTitle")}
        </Text>
        <Button size="sm" onClick={() => setMode("create")}>
          <Plus className="w-4 h-4 mr-1" />
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
        <VStack gap="12" align="center" className="py-12">
          <Text variant="muted">{t("callcenter.cards.builder.empty")}</Text>
          <Button onClick={() => setMode("create")}>
            <Plus className="w-4 h-4 mr-1" />
            {t("callcenter.cards.builder.createTemplate")}
          </Button>
        </VStack>
      ) : (
        <VStack gap="8" className="w-full">
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
              className="w-full p-4 border border-border rounded-lg"
            >
              <VStack gap="4">
                <Text className="font-medium">{tpl.name}</Text>
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
                      {q}
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
                name:
                  confirmDelete?.map((template) => template.name).join(", ") ??
                  "",
              })}
            </DialogTitle>
          </DialogHeader>
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
