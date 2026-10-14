import { useDeleteDirectoryMutation } from "@/shared/api/endpoints/directoryApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { Text } from "@/shared/ui";
import type { IDirectory } from "@krasterisk/shared";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import cls from "./DirectoriesTable.module.scss";

const columnHelper = createColumnHelper<IDirectory>();

export const useDirectoriesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteDirectory] = useDeleteDirectoryMutation();

  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("directories.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor("description", {
        header: () => t("directories.description"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue() || t("directories.noDescription")}
          </Text>
        ),
      }),

      columnHelper.accessor((row) => row.fields?.length ?? 0, {
        id: "fieldsCount",
        header: () => t("directories.fieldsCount"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor((row) => row.records?.length ?? 0, {
        id: "recordsCount",
        header: () => t("directories.recordsCount"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue()}
          </Text>
        ),
      }),
    ],
    [t, dispatch, deleteDirectory],
  );
};
