import type { CallsPage, CallsQuery } from "@krasterisk/shared";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { Button, Tooltip } from "@/shared/ui";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { aiChatActions } from "@/features/ai-chat/model/slice/aiChatSlice";
import { callResearchSeed } from "@/features/calls/model/callResearchSeed";

export function AskAboutCalls({
  query,
  page,
  busy,
  view,
}: {
  query: CallsQuery;
  page?: CallsPage;
  busy: boolean;
  view: string;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const seed = page && callResearchSeed(query, page, view, i18n.language);
  return (
    <Tooltip content={t("calls.askAi")}><Button
      variant="outline"
      size="icon"
      aria-label={t("calls.askAi")}
      disabled={busy || !seed}
      onClick={() => {
        if (seed) dispatch(aiChatActions.openWithSeed(seed));
      }}
    >
      <MessageSquare size={16} />
    </Button></Tooltip>
  );
}
