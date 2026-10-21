import { useId, useState } from "react";
import type { CallsQuery } from "@krasterisk/shared";
import { useTranslation } from "react-i18next";
import { useSearchCompanyCallTextQuery } from "@/shared/api/endpoints/callsApi";
import {
  Button,
  Flex,
  Input,
  Label,
  QueryErrorState,
  Select,
  Text,
  VStack,
  InfoTooltip,
} from "@/shared/ui";
import { callDuration, callTime } from "../model/callsUrl";
import cls from "./Calls.module.scss";
import { PhoneNumber } from '@/entities/phone';

export function CallTextSearch({
  query,
  onOpen,
  allowSemantic = false,
}: {
  query: CallsQuery;
  onOpen: (id: string, segment: string) => void;
  allowSemantic?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const [mode, setMode] = useState<"literal" | "semantic">("literal");
  const [phrase, setPhrase] = useState(""),
    [submitted, setSubmitted] = useState("");
  const {
    currentData: data,
    isFetching,
    isError,
    error,
    refetch,
  } = useSearchCompanyCallTextQuery(
    {
      cohort: query,
      phrase: submitted,
      ...(mode === "semantic" ? { mode } : {}),
    },
    {
      skip: !submitted || !expanded,
      refetchOnFocus: true,
      refetchOnMountOrArgChange: true,
      pollingInterval: submitted ? 30000 : 0,
    },
  );
  return (
    <details
      className={cls.filters}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary
        className={cls.searchSummary}
        role="button"
        aria-controls={bodyId}
        aria-expanded={expanded}
      >
        {t("calls.textSearch.title")}
      </summary>
      <VStack id={bodyId} gap="12" align="stretch" className={cls.searchBody}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (phrase.trim().length >= 2) {
              if (submitted === phrase.trim()) void refetch();
              else setSubmitted(phrase.trim());
            }
          }}
        >
          <VStack gap="8" align="stretch">
            {allowSemantic && (
              <>
                <Flex gap="4" align="center"><Label htmlFor="calls-content-mode">
                  {t("calls.textSearch.mode")}
                </Label><InfoTooltip text={t(mode === 'semantic' ? 'calls.textSearch.semanticNotice' : 'calls.textSearch.explanation')} /></Flex>
                <Select
                  id="calls-content-mode"
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value as "literal" | "semantic");
                    setSubmitted("");
                  }}
                >
                  <option value="literal">
                    {t("calls.textSearch.literal")}
                  </option>
                  {allowSemantic && (
                    <option value="semantic">
                      {t("calls.textSearch.semantic")}
                    </option>
                  )}
                </Select>
              </>
            )}
            <Flex gap="4" align="center"><Label htmlFor="calls-content-phrase">
              {t("calls.textSearch.phrase")}
            </Label>{!allowSemantic && <InfoTooltip text={t('calls.textSearch.explanation')} />}</Flex>
            <Input
              id="calls-content-phrase"
              value={phrase}
              maxLength={200}
              onChange={(event) => setPhrase(event.target.value)}
            />
            <Flex gap="8" wrap="wrap">
              <Button
                type="submit"
                disabled={isFetching || phrase.trim().length < 2}
              >
                {t("calls.textSearch.submit")}
              </Button>
              {submitted && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSubmitted("");
                    setPhrase("");
                  }}
                >
                  {t("calls.textSearch.clear")}
                </Button>
              )}
            </Flex>
          </VStack>
        </form>
        {isFetching && (
          <Text role="status">{t("calls.textSearch.loading")}</Text>
        )}
        {submitted &&
          (isError ? (
            <QueryErrorState
              message={t(error && 'data' in error && error.data && typeof error.data === 'object' && 'code' in error.data && error.data.code === 'CDR_SEARCH_QUERY_REDACTED'
                ? "calls.textSearch.queryRedacted" : "calls.textSearch.error")}
              onRetry={() => void refetch()}
            />
          ) : (
            data && (
              <>
                <Text role="status">
                  {t("calls.textSearch.coverage", {
                    cohort: data.coverage.cohortCalls,
                    considered: data.coverage.consideredCalls,
                    eligible: data.coverage.eligibleCalls,
                    segments: data.coverage.scannedSegments,
                  })}
                </Text>
                <Text variant="muted">{t("calls.textSearch.scopeNotice")}</Text>
                {data.semantic && (
                  <Text role="status">
                    {t(
                      `calls.textSearch.semanticState.${data.semantic.state}`,
                      {
                        indexed: data.semantic.indexedWindows,
                        total: data.semantic.totalWindows,
                      },
                    )}
                  </Text>
                )}
                {data.partialReasons.length > 0 && (
                  <Text role="status" className={cls.notice}>
                    {data.partialReasons.some(reason => reason !== 'privacy_limited') && `${t("calls.textSearch.partial")} `}
                    {data.partialReasons
                      .map((reason) => t(`calls.textSearch.reason.${reason}`))
                      .join(" · ")}
                  </Text>
                )}
                {!data.rows.length &&
                  (!data.semantic || data.semantic.state === "ready") && (
                    <Text>
                      {t(
                        mode === "semantic"
                          ? "calls.textSearch.semanticEmpty"
                          : "calls.textSearch.empty",
                      )}
                    </Text>
                  )}
                {data.rows.map((row) => (
                  <VStack
                    key={row.callId + ":" + row.segmentId}
                    gap="8"
                    align="stretch"
                    className={cls.transcriptSegment}
                  >
                    <Text>
                      <PhoneNumber number={row.caller.number} name={row.caller.name} fallback={t('calls.unknown')}/> →{" "}
                      <PhoneNumber number={row.recipient.number} name={row.recipient.name} fallback={t('calls.unknown')}/>
                    </Text>
                    <Text variant="muted">
                      {callTime(row.startedAt, data.timezone, i18n.language)} ·{" "}
                      {callDuration(Math.floor(row.startMs / 1000))} ·{" "}
                      {t(`calls.transcriptSpeaker.${row.speaker}`)}
                    </Text>
                    <Text className={`${cls.transcriptText} ${cls.searchSnippet}`}>{row.snippet}</Text>
                    <Button
                      variant="outline"
                      onClick={() => onOpen(row.callId, row.segmentId)}
                    >
                      {t("calls.textSearch.open")}
                    </Button>
                  </VStack>
                ))}
              </>
            )
          ))}
      </VStack>
    </details>
  );
}
