import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { IContext } from "@/shared/api/api";
import cls from "./ContextsTable.module.scss";

const columnHelper = createColumnHelper<IContext>();

export function useContextsTableColumns() {
  const { t } = useTranslation();
  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: t("contexts.name", "Имя"),
        cell: (info) => <Text className={cls.name}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor("comment", {
        header: t("contexts.description", "Описание"),
        cell: (info) => <Text variant="muted">{info.getValue() || "-"}</Text>,
      }),
      columnHelper.accessor(
        (row) =>
          [
            row.is_default_for_trunks && t("contexts.defaultForTrunks"),
            row.is_default_for_endpoints && t("contexts.defaultForEndpoints"),
          ]
            .filter(Boolean)
            .join(", "),
        {
          id: "defaults",
          header: t("contexts.purpose"),
          cell: (info) =>
            info.getValue() ? <Text>{info.getValue()}</Text> : null,
        },
      ),
    ],
    [t],
  );
}
