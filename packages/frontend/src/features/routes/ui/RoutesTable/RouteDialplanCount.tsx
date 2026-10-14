import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { IRouteAction } from "@krasterisk/shared";
import { Info } from "lucide-react";
import { DialplanActionsSummary } from "@/features/dialplan-apps";
import { Tooltip } from "@/shared/ui";
import cls from "./RoutesTable.module.scss";

export function RouteDialplanCount({
  actions,
  showIcon = false,
}: {
  actions: IRouteAction[];
  showIcon?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cls.dialplanTrigger}
      data-table-no-activate
      onClick={(event) => event.stopPropagation()}
    >
      <Tooltip
        open={open}
        onOpenChange={setOpen}
        side="left"
        contentClassName={cls.dialplanTooltip}
        content={
          <div data-table-no-activate>
            <DialplanActionsSummary actions={actions} />
          </div>
        }
      >
        <button
          type="button"
          className={cls.dialplanCount}
          aria-label={`${t("routes.modeRaw")}: ${actions.length}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          {showIcon && <Info size={14} aria-hidden />}
          {actions.length}
        </button>
      </Tooltip>
    </span>
  );
}
