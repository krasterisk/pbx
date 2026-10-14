import {
  useDeleteProvisionTemplateMutation,
  type IProvisionTemplate,
} from "@/shared/api/api";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import cls from "./ProvisionTemplatesTable.module.scss";

const columnHelper = createColumnHelper<IProvisionTemplate>();

export const useProvisionTemplatesTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteTemplate] = useDeleteProvisionTemplateMutation();

  return useMemo(
    () => [
      columnHelper.accessor("uid", {
        header: () => t("provisionTemplates.id"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor("name", {
        header: () => t("provisionTemplates.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),

      columnHelper.accessor("vendor", {
        header: () => t("provisionTemplates.vendor"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),

      columnHelper.accessor("model", {
        header: () => t("provisionTemplates.model"),
        cell: (info) => (
          <Text as="span" className={cls.muted}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),
    ],
    [t, dispatch, deleteTemplate],
  );
};
