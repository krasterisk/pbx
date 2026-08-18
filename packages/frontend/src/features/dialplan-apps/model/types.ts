import { type ActionType, type ActionCategory, type IRouteAction } from '@krasterisk/shared';
import type { FieldSchema } from './schema.types';

/**
 * Common properties passed to every Dialplan Application UI component.
 * `onUpdate` remains until 12-07 migrates the remaining 14 apps.
 */
export interface IDialplanAppProps {
  action: IRouteAction;
  /** Callback to update a specific parameter inside `action.params` or `action.type` etc. */
  onUpdate: (id: string, field: string, value: any) => void;
}

/** Sheet / schema-driven contract (D-06). Used by tracer `toqueue` and 12-07 apps. */
export interface IDialplanAppParamsProps<P = Record<string, unknown>> {
  params: P;
  onChange: (patch: Partial<P>) => void;
  readOnly?: boolean;
}

export type DialplanHost = 'route' | 'phonebook' | 'ivr';

export interface IDialplanAppConfig {
  type: ActionType;
  /** Translation key for the option, e.g. 'routes.action.totrunk' */
  labelKey: string;
  /** Custom UI Component for this app */
  component: React.FC<IDialplanAppProps>;
  /** Category for optgroup grouping */
  category: ActionCategory;
  /** Default params when this action is created */
  defaultParams?: Record<string, any>;
  /** Optional icon or description if needed in the future */
  descriptionKey?: string;
  schema?: FieldSchema[];
  summarize?: (
    params: Record<string, any>,
    t: (key: string, fallback?: string | Record<string, unknown>) => string,
    refs?: Record<string, unknown>,
  ) => string;
  terminal?: 'always' | 'conditional' | 'never';
  allowedIn?: ReadonlyArray<DialplanHost>;
  optionFlags?: ReadonlyArray<string>;
}
