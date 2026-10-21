const IMPORT_ERRORS: Record<string, string> = {
  duplicate_phone: 'duplicate', existing_duplicate_phone: 'existingDuplicate', row_invalid: 'rowInvalid',
  duplicate_external_id: 'duplicateExternalId', existing_duplicate_external_id: 'existingExternalId',
  AC_INVALID_DATE: 'date', AC_INVALID_NUMBER: 'number', AC_INVALID_BOOL: 'boolean', AC_INVALID_ENUM: 'enum',
  AC_REQUIRED_FIELD: 'required', AC_INVALID_PHONE: 'phone', invalid_phone: 'phone', no_phone: 'phone',
};
/** Backend codes stay stable for integrations; the UI explains a correction. */
export function autodialImportErrorKey(code: string, reason?: string): string {
  if (code === 'row_invalid' && reason && IMPORT_ERRORS[reason]) code = reason;
  return `autodial.workspace.importErrors.${IMPORT_ERRORS[code] ?? 'unknown'}`;
}
