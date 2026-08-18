export type ValueSource =
  | { source: 'fixed'; value: string }
  | { source: 'route_pattern' }
  | { source: 'variable'; name: string }
  | { source: 'phonebook'; phonebookUid: number };

export interface IQueueActionParams {
  target?: ValueSource;
  /** @deprecated Wave 0 field — read when `target` is absent */
  queue?: string;
  timeout?: number | string;
  options?: string;
  announceoverride?: string;
  priority?: number;
}
