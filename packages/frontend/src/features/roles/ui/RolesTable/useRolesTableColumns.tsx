import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { type IRole } from "@/shared/api/api";

import cls from "./RolesTable.module.scss";

const columnHelper = createColumnHelper<IRole>();

export function useRolesTableColumns() {
  const { t } = useTranslation();
  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("roles.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("comment", {
        header: () => t("roles.comment"),
        cell: (info) => (
          <Text as="span" className={cls.comment}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),
    ],
    [t],
  );
}
