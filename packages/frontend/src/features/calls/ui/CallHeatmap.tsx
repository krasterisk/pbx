import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CallCalendarDay } from "@krasterisk/shared";
import { Button, Flex, Text, VStack } from "@/shared/ui";
import cls from "./Calls.module.scss";

const PAGE = 7;
export function CallHeatmap({
  days,
  periodHref,
}: {
  days: CallCalendarDay[];
  periodHref: (from: string, to: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(0);
  const start =
    Math.min(page, Math.max(0, Math.ceil(days.length / PAGE) - 1)) * PAGE;
  const shown = days.slice(start, start + PAGE);
  const maximum = Math.max(
    1,
    ...days.flatMap((day) => day.hours.map((hour) => hour.total)),
  );
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      weekday: "short",
    }).format(new Date(`${date}T12:00:00Z`));
  return (
    <VStack gap="8" align="stretch">
      <Flex justify="between" align="center" wrap="wrap" gap="8">
        <Text variant="h3">{t("calls.heatmapTitle")}</Text>
        <Flex gap="8" align="center" wrap="wrap">
          <Button
            variant="outline"
            disabled={start === 0}
            onClick={() => setPage(Math.max(0, page - 1))}
          >
            {t("calls.heatmapPrevious")}
          </Button>
          <Text role="status">
            {shown[0]?.date} — {shown.at(-1)?.date}
          </Text>
          <Button
            variant="outline"
            disabled={start + PAGE >= days.length}
            onClick={() => setPage(page + 1)}
          >
            {t("calls.heatmapNext")}
          </Button>
        </Flex>
      </Flex>
      <Text variant="muted">{t("calls.heatmapHelp")}</Text>
      <VStack
        className={cls.heatmapScroll}
        role="region"
        aria-label={t("calls.heatmapTitle")}
        tabIndex={0}
      >
        <VStack className={cls.heatmapGrid} gap="4" align="stretch">
          <Flex className={cls.heatmapRow}>
            <Text as="span">{t("calls.heatmapDay")}</Text>
            {Array.from({ length: 24 }, (_, hour) => (
              <Text as="span" key={hour} align="center">
                {String(hour).padStart(2, "0")}
              </Text>
            ))}
          </Flex>
          {shown.map((day) => (
            <Flex className={cls.heatmapRow} key={day.date}>
              <Button variant="ghost" asChild className={cls.heatmapDate}>
                <Link
                  to={periodHref(day.from, day.to)}
                  aria-label={`${dateLabel(day.date)} · ${t("calls.overviewTotal")}: ${day.total}`}
                >
                  {dateLabel(day.date)}
                </Link>
              </Button>
              {Array.from({ length: 24 }, (_, hour) => {
                const occurrences = day.hours.filter(
                  (item) => item.hour === hour,
                );
                return (
                  <VStack gap="2" key={hour} className={cls.heatmapCell}>
                    {occurrences.length ? (
                      occurrences.map((item) => {
                        const offset = `${item.offsetMinutes < 0 ? "−" : "+"}${String(Math.floor(Math.abs(item.offsetMinutes) / 60)).padStart(2, "0")}:${String(Math.abs(item.offsetMinutes) % 60).padStart(2, "0")}`;
                        const clock = new Date(
                          Date.parse(item.from) + item.offsetMinutes * 60000,
                        )
                          .toISOString()
                          .slice(11, 16);
                        const label = `${day.date} ${clock} UTC${offset} · ${t("calls.overviewBucketCounts", { ...item })}`;
                        const level = item.total
                          ? Math.max(1, Math.ceil((item.total / maximum) * 4))
                          : 0;
                        return (
                          <Button
                            key={item.from}
                            variant="outline"
                            className={cls.heatmapValue}
                            data-intensity={level}
                            title={label}
                            aria-label={label}
                            disabled={!item.total}
                            asChild={!!item.total}
                          >
                            {item.total ? (
                              <Link to={periodHref(item.from, item.to)}>
                                {item.total}
                              </Link>
                            ) : (
                              "0"
                            )}
                          </Button>
                        );
                      })
                    ) : (
                      <Text
                        as="span"
                        align="center"
                        title={t("calls.heatmapMissing")}
                        aria-label={t("calls.heatmapMissing")}
                      >
                        —
                      </Text>
                    )}
                  </VStack>
                );
              })}
            </Flex>
          ))}
        </VStack>
      </VStack>
    </VStack>
  );
}
