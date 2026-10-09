import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2, Key } from "lucide-react";
import { VStack } from "@/shared/ui/Stack";
import { TableRowActions, TableRowAction, Text } from "@/shared/ui";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { endpointsPageActions } from "../../model/slice/endpointsPageSlice";
import { EndpointStatus, endpointCallerName } from "@/entities/endpoint";
import type { IEndpointListItem } from "@/shared/api/endpoints/endpointApi";
import cls from "./EndpointsTable.module.scss";

const columnHelper = createColumnHelper<IEndpointListItem>();

export const useEndpointsTableColumns = (
  onDelete: (endpoint: IEndpointListItem) => void,
) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return useMemo(
    () => [
      columnHelper.accessor("extension", {
        header: t("endpoints.extension"),
        sortingFn: (rowA, rowB, columnId) => {
          const a = String(rowA.getValue(columnId));
          const b = String(rowB.getValue(columnId));
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          if (
            !isNaN(numA) &&
            !isNaN(numB) &&
            String(numA) === a &&
            String(numB) === b
          ) {
            return numA - numB;
          }
          return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        },
        cell: (info) => (
          <Text as="span" className={cls.extension}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor("callerid", {
        header: t("endpoints.callerid"),
        cell: (info) => {
          const raw = info.getValue() || "";
          return (
            <Text as="span" className={cls.cell}>
              {endpointCallerName(raw)}
            </Text>
          );
        },
      }),

      columnHelper.accessor("department", {
        header: t("endpoints.department"),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),

      columnHelper.accessor("context", {
        header: t("endpoints.context"),
        cell: (info) => (
          <Text as="span" className={cls.contextChip}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor("status", {
        header: t("endpoints.status"),
        cell: (info) => <EndpointStatus endpoint={info.row.original} />,
      }),

      columnHelper.accessor("userAgent", {
        header: t("endpoints.network"),
        cell: (info) => (
          <VStack gap="2">
            {info.row.original.clientIp ? (
              <Text as="span" className={cls.mono}>
                {info.row.original.clientIp}
              </Text>
            ) : null}
            <Text
              as="span"
              className={cls.device}
              title={info.getValue() || ""}
            >
              {info.getValue() || "-"}
            </Text>
          </VStack>
        ),
      }),

      columnHelper.display({
        id: "actions",
        header: t("common.actions"),
        cell: (info) => {
          const ep = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t("endpoints.btnSip")}
                aria-label={t("endpoints.btnSip")}
                onClick={() =>
                  dispatch(endpointsPageActions.openCredentialsModal(ep.id))
                }
              >
                <Key />
              </TableRowAction>
              <TableRowAction
                title={t("common.edit")}
                aria-label={t("common.edit")}
                onClick={() => dispatch(endpointsPageActions.openEditModal(ep))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                danger
                title={t("common.delete")}
                aria-label={t("common.delete")}
                onClick={() => onDelete(ep)}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, dispatch, onDelete],
  );
};
