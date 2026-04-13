import { type ActionType, type IRouteAction } from '@krasterisk/shared';

/**
 * Common properties passed to every Dialplan Application UI component.
 */
export interface IDialplanAppProps {
  action: IRouteAction;
  /** Callback to update a specific parameter inside `action.params` or `action.type` etc. */
  onUpdate: (id: string, field: string, value: any) => void;
}

export interface IDialplanAppConfig {
  type: ActionType;
  /** Translation key for the option, e.g. 'routes.action.totrunk' */
  labelKey: string;
  /** Custom UI Component for this app */
  component: React.FC<IDialplanAppProps>;
  /** Category for optgroup grouping */
  category: string;
  /** Default params when this action is created */
  defaultParams?: Record<string, any>;
  /** Optional icon or description if needed in the future */
  descriptionKey?: string;
}
