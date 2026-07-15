/** v1 field types (14) — 'file' excluded per D-11. */
export type CardFieldType =
  | 'text'
  | 'textarea'
  | 'phone'
  | 'email'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'datetime'
  | 'number'
  | 'checkbox'
  | 'phonebook_lookup'
  | 'divider'
  | 'heading'
  | 'readonly';

export const CARD_FIELD_TYPES: CardFieldType[] = [
  'text',
  'textarea',
  'phone',
  'email',
  'select',
  'multi_select',
  'date',
  'datetime',
  'number',
  'checkbox',
  'phonebook_lookup',
  'divider',
  'heading',
  'readonly',
];

export type AutoOpenOn = 'answer' | 'ring' | 'manual';

export type CardStatus = 'draft' | 'saved' | 'missed' | 'callback_done';

export interface ICardField {
  uid?: number;
  field_key: string;
  field_type: CardFieldType;
  label: string;
  placeholder?: string;
  is_required?: boolean;
  default_value?: string;
  options?: string[] | null;
  depends_on?: string | null;
  depends_values?: string[] | null;
  sort_order?: number;
  width?: 'full' | 'half';
  auto_populate?: string | null;
}

export interface ICardTemplate {
  uid: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  auto_open_on: AutoOpenOn;
  auto_save_on_timeout: boolean;
  webhook_integration_uid?: number | null;
  webhook_field_map?: Record<string, string> | null;
  queue_names?: string[] | null;
  fields?: ICardField[];
}

export interface ICardData {
  uid: number;
  template_id: number;
  call_uniqueid: string;
  caller_id: string;
  queue_name: string;
  status: CardStatus;
  field_values: Record<string, unknown>;
  created_at: string;
}
