import type { ReactNode } from 'react';

export type FieldKind =
  | 'text'
  | 'number'
  | 'duration'
  | 'select'
  | 'multiselect'
  | 'toggle'
  | 'checkbox'
  | 'tags'
  | 'choice-cards'
  | 'mode'
  | 'secret'
  | 'value-source'
  | 'custom';

export type OptionsSource =
  | 'queues'
  | 'trunks'
  | 'ivrs'
  | 'prompts'
  | 'phonebooks'
  | 'tts-engines'
  | 'callGroups'
  | 'voiceRobots'
  | 'contexts'
  | 'endpoints'
  | 'numberLists'
  | 'notifications';

/** How ValueSourceField renders source pickers. */
export type ValueSourceMode = 'queue' | 'scalar' | 'dial';

export interface FieldOption {
  value: string;
  labelKey: string;
  label?: string;
  descriptionKey?: string;
  description?: string;
}

export interface SchemaCatalogRef {
  items: Array<{ value: string; label: string }>;
  isLoading: boolean;
  sectionHref: string;
  sectionKey?: string;
  sectionFallback: string;
}

export type SchemaRefs = Partial<Record<OptionsSource, SchemaCatalogRef>>;

export interface SchemaFieldRenderCtx {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
  field: FieldSchema;
  /** Current route extensions — used by dial-number preview when dest is route_pattern. */
  previewPatterns?: string[];
  tenantUid?: number;
}

export interface FieldVisibleWhenRule {
  key: string;
  equals: string | readonly string[];
}

export type FieldVisibleWhen = FieldVisibleWhenRule | readonly FieldVisibleWhenRule[];

export interface FieldSchema {
  key: string;
  kind: FieldKind;
  required?: boolean;
  labelKey: string;
  /** Fallback shown when the locale key is missing (t(key, fallback)). */
  label?: string;
  placeholder?: string;
  /** Hide visible field label (keep aria-label). Useful when a section title already names the field. */
  hideLabel?: boolean;
  /**
   * StepSheet placement.
   * - `primary` — always visible under the section title
   * - `params` — inside the collapsible «Параметры» block
   * Default heuristic: required → primary, else params (or all primary when nothing is required).
   */
  group?: 'primary' | 'params';
  /** ValueSource UI mode: queue catalog vs scalar (fixed number / variable / phonebook). */
  valueSourceMode?: ValueSourceMode;
  hintKey?: string;
  hint?: string;
  optionsSource?: OptionsSource;
  options?: FieldOption[];
  /** Hide the field unless `params[key]` matches `equals`. */
  visibleWhen?: FieldVisibleWhen;
  /**
   * Consecutive fields with the same `row` id render side-by-side.
   * Weights via `rowWeight` (e.g. 70 + 30). Stacks to one column below 640px.
   */
  row?: string;
  /** Relative width inside `row` (default 1). */
  rowWeight?: number;
  /** Custom field renderer. String `'custom'` is accepted as a flag from older schemas. */
  render?: 'custom' | ((ctx: SchemaFieldRenderCtx) => ReactNode);
}
