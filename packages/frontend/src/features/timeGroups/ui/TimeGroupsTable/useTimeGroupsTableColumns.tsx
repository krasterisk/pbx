import { Text, VStack } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ITimeGroup, ITimeGroupInterval } from "@krasterisk/shared";
import cls from "./TimeGroupsTable.module.scss";

const columnHelper = createColumnHelper<ITimeGroup>();

export const useTimeGroupsTableColumns = () => {
  const { t } = useTranslation();
  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("timeGroups.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("comment", {
        header: () => t("timeGroups.comment"),
        cell: (info) => (
          <Text as="span" className={cls.comment}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),
      columnHelper.accessor("intervals", {
        header: () => t("timeGroups.intervals"),
        enableSorting: false,
        cell: (info) => {
          const intervals = info.getValue() || [];
          if (intervals.length === 0) {
            return (
              <Text as="span" className={cls.noIntervals}>
                {t("timeGroups.noIntervals")}
              </Text>
            );
          }
          return (
            <VStack gap="2">
              {intervals.map((interval, i) => (
                <Text as="span" key={i} className={cls.intervalChip}>
                  {formatTimeGroupInterval(interval, t)}
                </Text>
              ))}
            </VStack>
          );
        },
      }),
    ],
    [t],
  );
};

export function formatTimeGroupInterval(
  interval: ITimeGroupInterval,
  t: TFunction,
): string {
  const parts: string[] = [];

  if (interval.time_start && interval.time_end) {
    parts.push(`${interval.time_start}–${interval.time_end}`);
  }

  if (interval.days_of_week && interval.days_of_week !== "*") {
    const sep = interval.days_of_week.includes("-") ? "–" : ", ";
    const labels = interval.days_of_week
      .split(/[-,]/)
      .map((d) => t(`timeGroups.weekdays.${d.trim()}`))
      .join(sep);
    parts.push(labels);
  }

  if (interval.days_of_month && interval.days_of_month !== "*") {
    parts.push(
      t("timeGroups.dayOfMonthShort", { days: interval.days_of_month }),
    );
  }

  if (interval.months && interval.months !== "*") {
    const sep = interval.months.includes("-") ? "–" : ", ";
    const labels = interval.months
      .split(/[-,]/)
      .map((m) => t(`timeGroups.months.${m.trim()}`))
      .join(sep);
    parts.push(labels);
  }

  return parts.join(" · ") || t("timeGroups.always");
}
