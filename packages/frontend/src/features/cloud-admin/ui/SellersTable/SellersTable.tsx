import type { IBillingSeller } from "@/entities/tenant";
import {
  useDeleteSellerMutation,
  useGetSellersQuery,
  useSetDefaultSellerMutation,
} from "@/shared/api/endpoints/cloudAdminApi";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableRowAction,
  TableRowActions,
  tableStyles,
  Text,
} from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Loader2, Plus, Star } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SellerFormModal } from "../SellerFormModal/SellerFormModal";
import cls from "./SellersTable.module.scss";

export const SellersTable = memo(function SellersTable() {
  const { t } = useTranslation();
  const {
    data: sellers = [],
    isLoading,
    isError: isListLoadError,
    refetch: retryListLoad,
  } = useGetSellersQuery();
  const [deleteSeller] = useDeleteSellerMutation();
  const [setDefault] = useSetDefaultSellerMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IBillingSeller | null>(null);
  const selection = useCrossPageRowSelection({ globalFilter: "" });
  const [deletingSelected, setDeletingSelected] = useState(false);
  const deletable = sellers.filter(
    (seller) => selection.rowSelection[String(seller.id)] && !seller.isDefault,
  );
  const deleteSelected = async () => {
    if (!deletable.length || deletingSelected) return;
    if (
      !window.confirm(
        t(
          "cloudAdmin.sellers.deleteConfirm",
          "Удалить поставщика «{{name}}»? Кабинеты будут переведены на поставщика по умолчанию.",
          { name: deletable.map((seller) => seller.name).join(", ") },
        ),
      )
    )
      return;
    setDeletingSelected(true);
    try {
      for (const seller of deletable) await deleteSeller(seller.id).unwrap();
      selection.clearSelection();
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingSelected(false);
    }
  };

  const columns = useMemo<ColumnDef<IBillingSeller>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("cloudAdmin.sellers.name", "Название"),
        cell: ({ row }) => (
          <HStack gap="8" align="center">
            <Text as="span" className={cls.name}>
              {row.original.name}
            </Text>
            {row.original.isDefault && (
              <Badge data-testid={`seller-default-${row.original.id}`}>
                {t("cloudAdmin.sellers.defaultBadge", "По умолчанию")}
              </Badge>
            )}
          </HStack>
        ),
      },
      {
        accessorKey: "inn",
        header: t("cloudAdmin.sellers.inn", "ИНН"),
        cell: ({ getValue }) => (
          <Text as="span" className={cls.muted}>
            {String(getValue() || "—")}
          </Text>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const seller = row.original;
          return (
            <TableRowActions>
              {!seller.isDefault && (
                <TableRowAction
                  type="button"
                  title={t(
                    "cloudAdmin.sellers.makeDefault",
                    "Сделать по умолчанию",
                  )}
                  aria-label={t(
                    "cloudAdmin.sellers.makeDefault",
                    "Сделать по умолчанию",
                  )}
                  onClick={() => void setDefault(seller.id)}
                >
                  <Star />
                </TableRowAction>
              )}
            </TableRowActions>
          );
        },
      },
    ],
    [t, setDefault],
  );

  const toolbar = (
    <Flex justify="between" align="center" max>
      <HStack gap="8" align="center">
        <Building2 size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t("cloudAdmin.sellers.title", "Поставщики")} ({sellers.length})
        </Text>
      </HStack>
      <Button
        id="sellers-create-btn"
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      >
        <Plus size={16} className={cls.createIcon} />
        <Text as="span">
          {t("cloudAdmin.sellers.create", "Новый поставщик")}
        </Text>
      </Button>
    </Flex>
  );

  if (isListLoadError)
    return (
      <QueryErrorState
        message={t("common.queryLoadError")}
        onRetry={() => void retryListLoad()}
      />
    );
  return (
    <VStack gap="20" max data-testid="sellers-table">
      <Card className={[tableStyles.surface, cls.card].join(" ")}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent className={cls.cardContent}>
          {isLoading ? (
            <Flex align="center" justify="center" className={cls.loading}>
              <Loader2 size={24} className={cls.spinner} />
            </Flex>
          ) : (
            <Table
              onRowClick={(seller) => {
                setEditing(seller);
                setModalOpen(true);
              }}
              surface={false}
              columns={columns}
              data={sellers}
              selectable
              getRowId={(seller) => String(seller.id)}
              rowSelection={selection.rowSelection}
              onRowSelectionChange={selection.onRowSelectionChange}
              toolbar={{
                onDeleteSelected: () => void deleteSelected(),
                deleteDisabled: deletingSelected || !deletable.length,
              }}
            />
          )}
        </CardContent>
      </Card>

      <SellerFormModal
        open={modalOpen}
        seller={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </VStack>
  );
});
