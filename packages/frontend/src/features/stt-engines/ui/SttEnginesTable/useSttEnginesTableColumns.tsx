import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ISttEngine } from "@/entities/engines";

import cls from "./SttEnginesTable.module.scss";

const columnHelper = createColumnHelper<ISttEngine>();

export const useSttEnginesTableColumns = () => {
  const { t } = useTranslation();
  const typeLabels: Record<string, string> = {
    google: t("sttEngines.typeGoogle"),
    yandex: t("sttEngines.typeYandex"),
    custom: t("sttEngines.typeCustom"),
  };
  return useMemo(
    () => [
      columnHelper.accessor("uid", {
        header: () => t("common.id", "№"),
        size: 60,
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("name", {
        header: () => t("sttEngines.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("type", {
        header: () => t("sttEngines.type"),
        size: 180,
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {typeLabels[info.getValue()] || info.getValue()}
          </Text>
        ),
      }),
    ],
    [t, typeLabels.google, typeLabels.yandex, typeLabels.custom],
  );
};
