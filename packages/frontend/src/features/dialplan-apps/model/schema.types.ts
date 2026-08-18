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

export type OptionsSource = 'queues' | 'trunks' | 'ivrs' | 'prompts' | 'phonebooks';

export interface FieldSchema {
  key: string;
  kind: FieldKind;
  required?: boolean;
  labelKey: string;
  hintKey?: string;
  optionsSource?: OptionsSource;
  render?: 'custom';
}
