import { UserLevelBadge } from "@/entities/User";
import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { IUser } from "@/entities/User";

import cls from "./UsersTable.module.scss";

const columnHelper = createColumnHelper<IUser>();

interface UseUsersTableColumnsProps {
  rolesMap: Record<number, string>;
  numbersMap: Record<number, string>;
}

export function useUsersTableColumns({
  rolesMap,
  numbersMap,
}: UseUsersTableColumnsProps) {
  const { t } = useTranslation();
  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("users.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("exten", {
        header: () => t("users.exten"),
        cell: (info) => (
          <Text as="span" className={cls.exten}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),
      columnHelper.accessor("email", {
        header: () => t("users.email"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),
      columnHelper.accessor("level", {
        header: () => t("users.level"),
        cell: (info) => <UserLevelBadge level={info.getValue()} />,
      }),
      columnHelper.accessor("role", {
        header: () => t("users.role"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {rolesMap[info.getValue()] || "-"}
          </Text>
        ),
      }),
      columnHelper.accessor("numbers_id", {
        header: () => t("users.numbersId"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue()
              ? numbersMap[info.getValue()] || String(info.getValue())
              : "-"}
          </Text>
        ),
      }),
    ],
    [t, rolesMap, numbersMap],
  );
}
