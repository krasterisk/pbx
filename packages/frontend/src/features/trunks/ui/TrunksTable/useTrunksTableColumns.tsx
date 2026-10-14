import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createColumnHelper } from "@tanstack/react-table";
import { Flex, Text } from "@/shared/ui";
import type { ITrunkListItem } from "@/shared/api/endpoints/trunkApi";
import cls from "./TrunksTable.module.scss";
import { TrunkStatus } from "./TrunkStatus";
import { TrunkRegistrationAction } from "./TrunkRegistrationAction";

const columnHelper = createColumnHelper<ITrunkListItem>();

export const useTrunksTableColumns = ({
  showRegistrationAction,
  pendingIds,
  onRegister,
}: {
  showRegistrationAction: boolean;
  pendingIds: ReadonlySet<string>;
  onRegister: (trunk: ITrunkListItem) => void;
}) => {
  const { t } = useTranslation();

  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("trunks.name"),
        cell: (info) => <Text className={cls.name}>{info.getValue()}</Text>,
      }),

      columnHelper.accessor("trunkType", {
        header: () => t("trunks.type"),
        cell: (info) => {
          const type = info.getValue();
          return (
            <Text
              as="span"
              className={type === "auth" ? cls.badgeAuth : cls.badgeIp}
            >
              {type === "auth" ? t("trunks.typeAuth") : t("trunks.typeIp")}
            </Text>
          );
        },
      }),

      columnHelper.accessor("host", {
        header: () => t("trunks.host"),
        cell: (info) => (
          <Text className={cls.mono}>{info.getValue() || "-"}</Text>
        ),
      }),

      columnHelper.accessor("username", {
        header: () => t("trunks.username"),
        cell: (info) => (
          <Text className={cls.mutedMono}>{info.getValue() || "-"}</Text>
        ),
      }),

      columnHelper.accessor("context", {
        header: () => t("trunks.context", "Контекст"),
        cell: (info) => (
          <Text as="span" className={cls.contextChip}>
            {info.getValue() || "-"}
          </Text>
        ),
      }),

      columnHelper.accessor("registrationStatus", {
        header: () => t("trunks.status", "Статус"),
        cell: (info) => {
          const trunk = info.row.original;
          return (
            <Flex gap="4" align="center">
              <TrunkStatus {...trunk} />
              {showRegistrationAction && (
                <TrunkRegistrationAction trunk={trunk} pending={pendingIds.has(trunk.id)} onRegister={onRegister} />
              )}
            </Flex>
          );
        },
      }),
    ],
    [t, showRegistrationAction, pendingIds, onRegister],
  );
};
