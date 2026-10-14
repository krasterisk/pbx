import { useGetAiVoiceRobotsQuery } from "@/shared/api/endpoints/aiVoiceRobotsApi";
import { Button, Flex, HStack, Table, Text, VStack } from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import type { AiVoiceRobot } from "@krasterisk/shared";
import { Bot, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RobotEditor } from "../RobotEditor";
import cls from "./RobotsTable.module.scss";
import { useRobotsTableColumns } from "./useRobotsTableColumns";

export function RobotsTable() {
  const { t } = useTranslation();
  const {
    data = [],
    isLoading,
    isError,
    refetch: retryListLoad,
  } = useGetAiVoiceRobotsQuery();
  const [filter, setFilter] = useState("");
  const [editor, setEditor] = useState<{
    robot?: AiVoiceRobot;
    copy?: boolean;
  } | null>(null);
  const edit = useCallback((robot: AiVoiceRobot) => setEditor({ robot }), []);
  const copy = useCallback(
    (robot: AiVoiceRobot) => setEditor({ robot, copy: true }),
    [],
  );
  const columns = useRobotsTableColumns(edit, copy);
  return (
    <VStack gap="24" max className={cls.page} data-testid="ai-robots-studio">
      <Flex justify="between" align="center" max className={cls.header}>
        <HStack gap="12">
          <Bot size={24} />
          <VStack gap="8" align="start">
            <Text variant="h1">{t("aiVoiceDesigner.title")}</Text>
            <Text variant="muted">{t("aiVoiceDesigner.subtitle")}</Text>
          </VStack>
        </HStack>
        <Button className={cls.create} onClick={() => setEditor({})}>
          <Plus size={16} />
          <Text as="span">{t("aiVoiceDesigner.create")}</Text>
        </Button>
      </Flex>
      {isError ? (
        <QueryErrorState
          message={t("aiVoiceDesigner.loadFailed")}
          onRetry={() => void retryListLoad()}
        />
      ) : isLoading ? (
        <Text>{t("common.loading")}</Text>
      ) : (
        <Flex
          max
          direction="column"
          align="stretch"
          className={cls.table}
          data-hybrid="overflow-x-auto"
        >
          <Table
            onRowClick={edit}
            columns={columns}
            data={data}
            globalFilter={filter}
            onGlobalFilterChange={setFilter}
            selectable
            toolbar={{
              searchPlaceholder: t("aiVoiceDesigner.search"),
              onCopySelected: copy,
              copyLabel: t("aiVoiceDesigner.copy"),
            }}
            getRowId={(row) => String(row.uid)}
            emptyText={t("aiVoiceDesigner.empty")}
          />
        </Flex>
      )}
      {editor ? (
        <RobotEditor {...editor} onClose={() => setEditor(null)} />
      ) : null}
    </VStack>
  );
}
