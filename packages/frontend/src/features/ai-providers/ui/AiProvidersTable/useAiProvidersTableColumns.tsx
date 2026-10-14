import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  type AiCapability,
  type IAiProvider,
} from "@/shared/api/endpoints/aiAgentsApi";
import { Text } from "@/shared/ui";
import { HStack } from "@/shared/ui/Stack";
import cls from "./AiProvidersTable.module.scss";

const columnHelper = createColumnHelper<IAiProvider>();

const CAP_LABEL: Record<AiCapability, string> = {
  llm: "aiProviders.field.capLlm",
  stt: "aiProviders.field.capStt",
  tts: "aiProviders.field.capTts",
  realtime: "aiProviders.field.capRealtime",
  tools: "aiProviders.field.capLlm",
  function_calling: "aiProviders.field.capLlm",
};

const KIND_LABEL: Record<IAiProvider["kind"], string> = {
  online: "aiProviders.field.kindOnline",
  local: "aiProviders.field.kindLocal",
  custom: "aiProviders.field.kindCustom",
};

interface UseAiProvidersTableColumnsArgs {
  onEdit: (provider: IAiProvider) => void;
}

export const useAiProvidersTableColumns = ({
  onEdit,
}: UseAiProvidersTableColumnsArgs) => {
  const { t } = useTranslation();

  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("aiAgents.col.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("vendor", {
        header: () => t("aiAgents.col.vendor"),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("kind", {
        header: () => t("aiAgents.col.kind"),
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {t(KIND_LABEL[info.getValue()])}
          </Text>
        ),
      }),
      columnHelper.accessor("capabilities", {
        header: () => t("aiAgents.col.capabilities"),
        cell: (info) => (
          <HStack gap="4" className={cls.caps}>
            {info.getValue().map((cap) => (
              <Text key={cap} as="span" className={cls.cap}>
                {t(CAP_LABEL[cap] ?? cap)}
              </Text>
            ))}
          </HStack>
        ),
      }),
      columnHelper.accessor("enabled", {
        header: () => t("aiAgents.col.enabled"),
        cell: (info) => (
          <Text
            as="span"
            className={info.getValue() ? cls.statusOn : cls.statusOff}
          >
            {info.getValue()
              ? t("aiProviders.statusOn")
              : t("aiProviders.statusOff")}
          </Text>
        ),
      }),
    ],
    [onEdit, t],
  );
};
