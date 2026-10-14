import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ITtsEngine } from "@/entities/engines";

import cls from "./TtsEnginesTable.module.scss";

const columnHelper = createColumnHelper<ITtsEngine>();

export const useTtsEnginesTableColumns = () => {
  const { t } = useTranslation();
  const typeLabels: Record<string, string> = {
    google: t("ttsEngines.typeGoogle"),
    yandex: t("ttsEngines.typeYandex"),
    custom: t("ttsEngines.typeCustom"),
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
        header: () => t("ttsEngines.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("type", {
        header: () => t("ttsEngines.type"),
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
