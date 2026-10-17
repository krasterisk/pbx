/** Generic directory binding, stored in the existing JSON options column. */
export interface CardDirectorySource {
  source: 'directory';
  directoryUid: number;
  valueFieldUid: number;
  labelFieldUid: number;
}
export type CardFieldOptions = string[] | CardDirectorySource;
export interface CardChoice { value: string; label: string }
export function isCardDirectorySource(value: unknown): value is CardDirectorySource {
  return !!value && !Array.isArray(value) && typeof value === 'object' && (value as CardDirectorySource).source === 'directory';
}
export function cardChoiceValue(value: unknown): string {
  return value != null && typeof value === 'object' && 'value' in value ? String(value.value) : value == null ? '' : String(value);
}
export function cardAnswerLabel(value: unknown): string {
  if (Array.isArray(value)) return value.map(cardAnswerLabel).join(', ');
  if (value != null && typeof value === 'object' && 'label' in value) return String(value.label);
  return value == null ? '' : String(value);
}
