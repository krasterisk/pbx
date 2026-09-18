import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/shared/ui";
import { VStack } from "@/shared/ui/Stack";
import { filterTimeZones, formatTimeZoneOption } from "../../lib/timezones";
import cls from "./TimeZoneSelect.module.scss";

interface Props {
  id: string;
  value: string;
  onChange: (timeZone: string) => void;
  disabled?: boolean;
}

/** Searchable, browser-native IANA selector for campaign operating hours. */
export const TimeZoneSelect = memo(
  ({ id, value, onChange, disabled = false }: Props) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const options = useMemo(
      () => filterTimeZones(query, value),
      [query, value],
    );

    return (
      <VStack
        gap="4"
        max
        className={cls.root}
        data-testid="autodial-timezone-select"
      >
        <Input
          id={`${id}-search`}
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("autodial.schedule.timezoneSearch")}
          aria-label={t("autodial.schedule.timezoneSearch")}
        />
        <Select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={t("autodial.schedule.timezone")}
        >
          {options.length === 0 ? (
            <option value="" disabled>
              {t("autodial.schedule.timezoneEmpty")}
            </option>
          ) : (
            options.map((timeZone) => (
              <option key={timeZone} value={timeZone}>
                {formatTimeZoneOption(timeZone)}
              </option>
            ))
          )}
        </Select>
      </VStack>
    );
  },
);

TimeZoneSelect.displayName = "TimeZoneSelect";
