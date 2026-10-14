import { Flex, HStack, Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { type IRoute } from "@/shared/api/endpoints/routeApi";

import cls from "./RoutesTable.module.scss";
import { RouteDialplanCount } from "./RouteDialplanCount";

const columnHelper = createColumnHelper<IRoute>();

export function useRoutesTableColumns(contextMap: Record<number, string>) {
  const { t } = useTranslation();
  return useMemo(
    () => [
      columnHelper.accessor("priority", {
        header: () => t("routes.priority"),
        size: 50,
        cell: (info) => (
          <Text as="span" className={cls.priority}>
            {info.row.index + 1}
          </Text>
        ),
      }),
      columnHelper.accessor("active", {
        header: () => t("common.active"),
        size: 80,
        cell: (info) => (
          <Flex
            className={
              info.getValue() ? cls.statusDotActive : cls.statusDotInactive
            }
            title={t(info.getValue() ? "common.active" : "common.inactive")}
            aria-label={t(
              info.getValue() ? "common.active" : "common.inactive",
            )}
          >
            {""}
          </Flex>
        ),
      }),
      columnHelper.accessor("name", {
        header: () => t("routes.name"),
        size: 200,
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("context_uid", {
        header: () => t("routes.context"),
        size: 160,
        cell: (info) => (
          <Text as="span" className={cls.contextName}>
            {contextMap[info.getValue()] || String(info.getValue())}
          </Text>
        ),
      }),
      columnHelper.accessor("extensions", {
        header: () => t("routes.extensions"),
        size: 220,
        cell: (info) => (
          <HStack gap="2" className={cls.extChips}>
            {(info.getValue() || []).map((ext) => (
              <Text key={ext} as="span" className={cls.extChip}>
                {ext}
              </Text>
            ))}
          </HStack>
        ),
      }),
      columnHelper.accessor("actions", {
        header: () => t("routes.modeRaw"),
        size: 100,
        cell: (info) => <RouteDialplanCount actions={info.getValue() ?? []} />,
      }),
    ],
    [t, contextMap],
  );
}
