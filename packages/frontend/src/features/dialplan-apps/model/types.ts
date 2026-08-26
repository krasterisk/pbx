import { type ActionType, type ActionCategory } from '@krasterisk/shared';
import type { FieldSchema } from './schema.types';

export type DialplanHost = 'route' | 'phonebook' | 'ivr';

export interface IDialplanAppConfig {
  type: ActionType;
  /** Translation key for the option, e.g. 'routes.action.totrunk' */
  labelKey: string;
  /** Category for optgroup grouping */
  category: ActionCategory;
  /** Default params when this action is created */
  defaultParams?: Record<string, any>;
  /** Optional icon or description if needed in the future */
  descriptionKey?: string;
  schema: FieldSchema[];
  summarize: (
    params: Record<string, any>,
    t: (key: string, fallback?: any) => string,
    refs?: Record<string, unknown>,
  ) => string;
  terminal: 'always' | 'conditional' | 'never';
  allowedIn: ReadonlyArray<DialplanHost>;
  optionFlags: ReadonlyArray<string>;
  /** When false, hidden from ActionTypeSelect on new steps (dual-read legacy). */
  offerOnCreate?: boolean;
  /** Primary StepSheet block title / tooltip (defaults to «Параметры»). */
  primarySection?: {
    titleKey: string;
    title?: string;
    tooltipKey?: string;
    tooltip?: string;
    /** Hide labels on primary fields when the section title already names them. */
    hideFieldLabels?: boolean;
  };
  /**
   * Tooltip for the collapsible «Дополнительные параметры» block.
   * Set it per app — the generic fallback cannot describe app-specific fields
   * and a tooltip that lists fields the section does not contain is worse than none.
   */
  paramsSection?: {
    tooltipKey?: string;
    tooltip?: string;
  };
}
