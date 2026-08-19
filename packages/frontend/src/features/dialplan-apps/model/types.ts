import { type ActionType, type ActionCategory } from '@krasterisk/shared';
import type { FieldSchema } from './schema.types';

/** Sheet / schema-driven contract (D-06). Apps do not receive their step id. */
export interface IDialplanAppProps<P = Record<string, unknown>> {
  params: P;
  onChange: (patch: Partial<P>) => void;
  readOnly?: boolean;
  /** Discriminator for shared shells (GenericApp / CallerIdApp). Not the step id. */
  actionType?: ActionType;
}

/** @deprecated use IDialplanAppProps */
export type IDialplanAppParamsProps<P = Record<string, unknown>> = IDialplanAppProps<P>;

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
}
