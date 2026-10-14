import { createColumnHelper } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Text } from "@/shared/ui";

import type { ICallGroup } from "@krasterisk/shared";

import cls from "./CallGroupsTable.module.scss";

const columnHelper = createColumnHelper<ICallGroup>();

const STRATEGY_KEYS = ["ringall", "hunt", "memoryhunt", "random"] as const;

export function formatCallGroupStrategy(
  strategy: string | undefined,
  t: TFunction,
): string {
  if (!strategy) return "-";
  if (STRATEGY_KEYS.includes(strategy as (typeof STRATEGY_KEYS)[number])) {
    return t(`callGroups.strategy.${strategy}`);
  }
  return strategy;
}

export const useCallGroupsTableColumns = () => {
  const { t } = useTranslation();

  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("callGroups.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor("strategy", {
        header: () => t("callGroups.strategy"),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {formatCallGroupStrategy(info.getValue(), t)}
          </Text>
        ),
      }),

      columnHelper.accessor((row) => row.members?.length ?? 0, {
        id: "memberCount",
        header: () => t("callGroups.members"),
        cell: (info) => {
          const count = info.getValue();
          return (
            <Text
              as="span"
              className={
                count > 0 ? cls.memberBadgeActive : cls.memberBadgeMuted
              }
            >
              {count}
            </Text>
          );
        },
      }),
    ],
    [t],
  );
};
