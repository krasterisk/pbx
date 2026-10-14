import { Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { IVoiceRobot } from "@/entities/voiceRobot";
import cls from "./VoiceRobotsTable.module.scss";

const columnHelper = createColumnHelper<IVoiceRobot>();

interface UseVoiceRobotsTableColumnsArgs {
  onEdit: (robot: IVoiceRobot) => void;
  onCopy: (robot: IVoiceRobot) => void;
  onDelete: (robot: IVoiceRobot) => void;
}

export const useVoiceRobotsTableColumns = (
  _args: UseVoiceRobotsTableColumnsArgs,
) => {
  const { t } = useTranslation();
  return useMemo(
    () => [
      columnHelper.accessor("uid", {
        header: () => t("voiceRobots.id"),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("name", {
        header: () => t("voiceRobots.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("active", {
        header: () => t("voiceRobots.status"),
        cell: (info) => {
          const active = info.getValue();
          return (
            <Text as="span" className={active ? cls.statusOn : cls.statusOff}>
              {active ? t("common.active") : t("common.inactive")}
            </Text>
          );
        },
      }),
    ],
    [t],
  );
};
