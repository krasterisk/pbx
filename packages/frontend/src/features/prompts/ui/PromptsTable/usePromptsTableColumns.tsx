import type { IPrompt } from "@/entities/prompt";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { TableRowAction, TableRowActions, Text } from "@/shared/ui";
import { createColumnHelper } from "@tanstack/react-table";
import { Play, Square } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import cls from "./PromptsTable.module.scss";

const columnHelper = createColumnHelper<IPrompt>();

interface UsePromptsTableColumnsArgs {
  playingId: number | null;
  onPlay: (prompt: IPrompt) => void;
  onDelete: (prompt: IPrompt) => void;
}

export const usePromptsTableColumns = ({
  playingId,
  onPlay,
  onDelete,
}: UsePromptsTableColumnsArgs) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return useMemo(
    () => [
      columnHelper.display({
        id: "rowNumber",
        header: () => "№",
        size: 56,
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {info.row.index + 1}
          </Text>
        ),
      }),

      columnHelper.accessor("comment", {
        header: () => t("promptsPage.name"),
        cell: (info) => (
          <Text as="span" className={cls.name}>
            {info.getValue() || info.row.original.filename}
          </Text>
        ),
      }),

      columnHelper.accessor("source_type", {
        header: () => t("promptsPage.type.column"),
        size: 110,
        cell: (info) => (
          <Text as="span" className={cls.cell}>
            {info.getValue() === "tts"
              ? t("promptsPage.type.tts")
              : t("promptsPage.type.file")}
          </Text>
        ),
      }),

      columnHelper.accessor("description", {
        header: () => t("promptsPage.description"),
        cell: (info) => (
          <Text as="span" className={cls.comment}>
            {info.getValue()?.trim() || "-"}
          </Text>
        ),
      }),

      columnHelper.display({
        id: "actions",
        header: () => t("common.actions"),
        cell: (info) => {
          const prompt = info.row.original;
          const isPlaying = playingId === prompt.uid;
          return (
            <TableRowActions>
              <TableRowAction
                title={t("promptsPage.play")}
                aria-label={t("promptsPage.play")}
                onClick={() => onPlay(prompt)}
              >
                {isPlaying ? <Square /> : <Play />}
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, dispatch, playingId, onPlay, onDelete],
  );
};
