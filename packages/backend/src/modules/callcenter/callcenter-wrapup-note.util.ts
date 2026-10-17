/** Which card field receives the wrap-up note. */
export function wrapupNoteFieldKey(
  fields: ReadonlyArray<{ field_key: string; field_type: string }>,
): string {
  const keys = new Set(fields.map((field) => field.field_key));
  for (const key of ['note', 'comment', 'notes', 'wrapup_note']) {
    if (keys.has(key)) return key;
  }
  const text = fields.find((field) => field.field_type === 'textarea' || field.field_type === 'text');
  return text?.field_key ?? 'wrapup_note';
}
