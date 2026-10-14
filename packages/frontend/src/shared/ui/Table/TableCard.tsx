import { classNames } from "@/shared/lib/classNames/classNames";
import { forwardRef, useId, type ReactNode } from "react";
import { Checkbox } from "../Checkbox/Checkbox";
import { Label } from "../Label/Label";
import { Flex, type FlexProps } from "../Stack/Flex/Flex";
import cls from "./Table.module.scss";
import { tableActivation } from "./tableActivation";

export interface TableCardProps extends FlexProps {
  onActivate?: () => void;
  selection?: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
  };
}

/** The mobile counterpart of a TableRow, with the same guarded activation. */
export const TableCard = forwardRef<HTMLDivElement, TableCardProps>(
  (
    {
      onActivate,
      selection,
      children,
      className,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const checkboxId = useId();
    return (
      <Flex
        ref={ref}
        direction="column"
        align="stretch"
        role={onActivate ? "button" : undefined}
        data-table-card
        data-table-activatable={onActivate ? "true" : undefined}
        className={classNames(
          cls.card,
          {
            [cls.interactive]: !!onActivate,
            [cls.selectableCard]: !!selection,
          },
          [className],
        )}
        {...tableActivation(onActivate, { onClick, onKeyDown })}
        {...props}
        {...(selection ? { "data-selected": selection.checked } : {})}
      >
        {selection && (
          <Label
            htmlFor={checkboxId}
            className={cls.cardSelection}
            data-table-no-activate
          >
            <Checkbox
              id={checkboxId}
              checked={selection.checked}
              disabled={selection.disabled}
              aria-label={selection.label}
              onChange={(event) =>
                selection.onCheckedChange(event.target.checked)
              }
            />
          </Label>
        )}
        {children}
      </Flex>
    );
  },
);
TableCard.displayName = "TableCard";

/** Compact, labelled parameters shared by mobile entity cards. */
export function TableCardDetails({
  fields,
}: {
  fields: { id: string; label: ReactNode; value: ReactNode }[];
}) {
  return (
    <dl className={cls.cardDetails}>
      {fields.map(({ id, label, value }) => (
        <div key={id} className={cls.cardField}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
