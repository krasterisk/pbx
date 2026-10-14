import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { IRouteAction } from "@krasterisk/shared";
import { dialplanAppsRegistry } from "../../model/registry";
import type { OptionsSource } from "../../model/schema.types";
import { stripActionTitleFromSummary } from "../../model/stripActionTitleFromSummary";
import { useSchemaRefs } from "../../model/useSchemaRefs";
import cls from "./DialplanActionsSummary.module.scss";

/** Read-only action/value preview using the same summaries and catalogs as StepRow. */
export function DialplanActionsSummary({
  actions,
}: {
  actions: IRouteAction[];
}) {
  const { t } = useTranslation();
  const sources = useMemo(() => {
    const required = new Set<OptionsSource>();
    for (const action of actions) {
      const config = dialplanAppsRegistry[action.type];
      for (const field of config?.schema ?? []) {
        if (field.optionsSource) required.add(field.optionsSource);
        if (field.kind === "value-source") required.add("dialplanDirectories");
      }
      if (action.type === "totrunk") required.add("trunkIds");
    }
    return [...required];
  }, [actions]);
  const refs = useSchemaRefs(sources);

  if (!actions.length)
    return <p className={cls.empty}>{t("routes.chain.empty.readOnly")}</p>;

  return (
    <ol className={cls.list}>
      {actions.map((action, index) => {
        const config = dialplanAppsRegistry[action.type];
        const title = config ? t(config.labelKey, action.type) : action.type;
        const summary = config
          ? stripActionTitleFromSummary(
              title,
              config.summarize(action.params ?? {}, t, refs),
            )
          : t("routes.chain.unknown.summary");
        return (
          <li
            className={cls.step}
            key={action.id || index}
            data-enabled={action.enabled !== false}
          >
            <span className={cls.index}>{index + 1}</span>
            <div className={cls.details}>
              <div className={cls.title}>
                {title}
                {action.enabled === false && (
                  <span className={cls.disabled}>
                    {t("routes.chain.badge.disabled")}
                  </span>
                )}
              </div>
              {summary && <div className={cls.value}>{summary}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
