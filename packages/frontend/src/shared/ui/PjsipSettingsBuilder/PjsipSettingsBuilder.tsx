import { memo, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "../Button";
import { Input } from "../Input";
import { Select } from "../Select/Select";
import { Text } from "../Text/Text";
import { InfoTooltip } from "../Tooltip/Tooltip";
import { HStack, VStack, Flex } from "../Stack";
import { TableRowAction, TableRowActions } from "../TableRowActions";
import { ADVANCED_PJSIP_FIELDS } from "@/shared/config/pjsipAdvancedFields";
import { pjsipCategory, pjsipValueError } from "@/shared/lib/pjsipSettings";
import cls from "./PjsipSettingsBuilder.module.scss";

export interface PjsipSettingsBuilderProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, string>) => void;
  onValidationChange?: (valid: boolean) => void;
  excludeFields?: string[];
  fields?: string[];
  title?: string;
  description?: string;
}
interface Item {
  id: number;
  key: string;
  val: string;
  open: boolean;
}
const signature = (value: Record<string, unknown>) =>
  JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

export const PjsipSettingsBuilder = memo(
  ({
    value,
    onChange,
    onValidationChange,
    excludeFields,
    fields,
    title,
    description,
  }: PjsipSettingsBuilderProps) => {
    const { t } = useTranslation();
    const prefix = useId();
    const nextId = useRef(0);
    const fromValue = (input: Record<string, unknown>): Item[] =>
      Object.entries(input).map(([key, val]) => ({
        id: nextId.current++,
        key,
        val: String(val ?? ""),
        open: false,
      }));
    const [items, setItems] = useState<Item[]>(() => fromValue(value));
    const observed = useRef(signature(value));
    const incoming = signature(value);
    useEffect(() => {
      if (incoming !== observed.current) {
        observed.current = incoming;
        setItems(
          (JSON.parse(incoming) as [string, unknown][]).map(([key, val]) => ({
            id: nextId.current++,
            key,
            val: String(val ?? ""),
            open: false,
          })),
        );
      }
    }, [incoming]);

    const fieldList = (fields ?? ADVANCED_PJSIP_FIELDS).filter(
      (key) => !excludeFields?.includes(key),
    );
    const errorFor = (item: Item) =>
      !item.key
        ? "endpoints.selectParameter"
        : !fieldList.includes(item.key)
          ? "endpoints.invalidParameter"
          : items.filter((other) => other.key === item.key).length > 1
            ? "endpoints.duplicateParameter"
            : pjsipValueError(item.key, item.val);
    const valid = items.every((item) => !errorFor(item));
    useEffect(() => {
      onValidationChange?.(valid);
    }, [valid, onValidationChange]);

    const update = (next: Item[]) => {
      setItems(next);
      const output = Object.fromEntries(
        next.filter((item) => item.key).map((item) => [item.key, item.val]),
      );
      observed.current = signature(output);
      onChange(output);
    };

    return (
      <VStack gap="16" max align="stretch">
        <HStack gap="4">
          <Text as="h4" className={cls.title}>
            {title ?? t("endpoints.advancedBuilderTitle")}
          </Text>
          <InfoTooltip
            text={description ?? t("endpoints.advancedBuilderDesc")}
          />
        </HStack>
        {items.map((item) => {
          const error = errorFor(item);
          const keyId = `${prefix}-${item.id}-key`;
          const valueId = `${prefix}-${item.id}-value`;
          return (
            <VStack key={item.id} max align="stretch" className={cls.card}>
              <HStack gap="8" justify="between" max>
                <Button
                  type="button"
                  variant="ghost"
                  className={cls.cardHeader}
                  aria-expanded={item.open}
                  aria-controls={`${prefix}-${item.id}-body`}
                  onClick={() =>
                    setItems(
                      items.map((row) =>
                        row.id === item.id ? { ...row, open: !row.open } : row,
                      ),
                    )
                  }
                >
                  <Text as="span">
                    {item.key || t("endpoints.selectParameter")}
                  </Text>
                  <ChevronDown
                    size={16}
                    className={item.open ? cls.chevronOpen : cls.chevron}
                  />
                </Button>
                <TableRowActions>
                  <TableRowAction
                    danger
                    title={t("endpoints.removeParameter")}
                    aria-label={t("endpoints.removeParameter")}
                    onClick={() =>
                      update(items.filter((row) => row.id !== item.id))
                    }
                  >
                    <Trash2 />
                  </TableRowAction>
                </TableRowActions>
              </HStack>
              {item.open && (
                <Flex
                  id={`${prefix}-${item.id}-body`}
                  className={cls.row}
                  align="stretch"
                >
                  <Select
                    id={keyId}
                    aria-label={t("endpoints.selectParameter")}
                    value={item.key}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${valueId}-error` : undefined}
                    onChange={(event) =>
                      update(
                        items.map((row) =>
                          row.id === item.id
                            ? { ...row, key: event.target.value }
                            : row,
                        ),
                      )
                    }
                    options={[
                      {
                        value: "",
                        label: t("endpoints.selectParameter"),
                        disabled: true,
                      },
                      ...fieldList
                        .filter(
                          (key) =>
                            key === item.key ||
                            !items.some((row) => row.key === key),
                        )
                        .sort()
                        .map((key) => ({
                          value: key,
                          label: key,
                          group: t(
                            `endpoints.parameterCategory.${pjsipCategory(key)}`,
                          ),
                        })),
                    ]}
                  />
                  <Input
                    id={valueId}
                    aria-label={t("endpoints.parameterValue")}
                    value={item.val}
                    className={cls.mono}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${valueId}-error` : undefined}
                    onChange={(event) =>
                      update(
                        items.map((row) =>
                          row.id === item.id
                            ? { ...row, val: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Flex>
              )}
              {error && (
                <Text
                  id={`${valueId}-error`}
                  role="alert"
                  className={cls.error}
                >
                  {t(error)}
                </Text>
              )}
            </VStack>
          );
        })}
        {fieldList.some((key) => !items.some((item) => item.key === key)) && (
          <Button
            type="button"
            variant="outline"
            className={cls.add}
            onClick={() =>
              setItems([
                ...items,
                { id: nextId.current++, key: "", val: "", open: true },
              ])
            }
          >
            <Plus size={16} />
            {t("endpoints.addParameter")}
          </Button>
        )}
      </VStack>
    );
  },
);
PjsipSettingsBuilder.displayName = "PjsipSettingsBuilder";
