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

export type OptionsSource = 'queues' | 'trunks' | 'ivrs' | 'prompts' | 'phonebooks' | 'tts-engines';

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
}

export interface FieldVisibleWhen {
  key: string;
  equals: string | readonly string[];
}

export interface FieldSchema {
  key: string;
  kind: FieldKind;
  required?: boolean;
  labelKey: string;
  hintKey?: string;
  optionsSource?: OptionsSource;
  options?: FieldOption[];
  /** Hide the field unless `params[key]` matches `equals`. */
  visibleWhen?: FieldVisibleWhen;
  /** Custom field renderer. String `'custom'` is accepted as a flag from older schemas. */
  render?: 'custom' | ((ctx: SchemaFieldRenderCtx) => ReactNode);
}
