import { useDeleteQueueMutation } from "@/shared/api/endpoints/queueApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { IQueue } from "../../model/types/queuesSchema";
import cls from "./QueuesTable.module.scss";

const columnHelper = createColumnHelper<IQueue>();

export function formatQueueStrategy(
  strategy: string | undefined,
  t: TFunction,
): string {
  if (!strategy) return "-";
  const key = `queues.strategy.${strategy}`;
  const label = t(key);
  return label === key ? strategy : label;
}

export const useQueuesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteQueue] = useDeleteQueueMutation();

  return useMemo(
    () => [
      columnHelper.accessor((row) => row.exten || row.name, {
        id: "exten",
        header: () => t("queues.exten"),
        cell: (info) => (
          <Text as="span" className={cls.exten}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor("display_name", {
        header: () => t("queues.displayName"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),

      columnHelper.accessor("strategy", {
        header: () => t("queues.strategy"),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {formatQueueStrategy(info.getValue(), t)}
          </Text>
        ),
      }),

      columnHelper.accessor("memberCount", {
        header: () => t("queues.members"),
        cell: (info) => {
          const count = info.getValue() || 0;
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

      columnHelper.accessor("timeout", {
        header: () => t("queues.timeout"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue() ?? "-"}s
          </Text>
        ),
      }),

      columnHelper.accessor("maxlen", {
        header: () => t("queues.maxlen"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue() || "∞"}
          </Text>
        ),
      }),
    ],
    [t, dispatch, deleteQueue],
  );
};
