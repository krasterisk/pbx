import { Text } from "@/shared/ui";
import type { AiVoiceRobot } from "@krasterisk/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useRobotsTableColumns(
  _onEdit: (robot: AiVoiceRobot) => void,
  _onCopy: (robot: AiVoiceRobot) => void,
) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<AiVoiceRobot>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.config.name,
        header: t("aiVoiceDesigner.name"),
        cell: ({ row }) => <Text>{row.original.config.name}</Text>,
      },
      {
        id: "mode",
        accessorFn: (row) => row.config.mode,
        header: t("aiVoiceDesigner.pipeline"),
        cell: ({ row }) => (
          <Text>{t(`aiVoiceDesigner.${row.original.config.mode}`)}</Text>
        ),
      },
      {
        id: "enabled",
        accessorFn: (row) => row.config.enabled,
        header: t("aiVoiceDesigner.enabled"),
        cell: ({ row }) => (
          <Text>
            {t(
              `aiVoiceDesigner.${row.original.config.enabled ? "active" : "inactive"}`,
            )}
          </Text>
        ),
      },
      { accessorKey: "revision", header: t("aiVoiceDesigner.revision") },
    ],
    [t],
  );
}
