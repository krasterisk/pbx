import { describe, expect, it } from 'vitest';
import { autodialImportErrorKey } from './importError';

describe('import correction reasons', () => {
  it('explains the known validation cause behind a stable row_invalid code', () => {
    expect(autodialImportErrorKey('row_invalid', 'AC_INVALID_BOOL')).toBe('autodial.workspace.importErrors.boolean');
    expect(autodialImportErrorKey('row_invalid', 'AC_INVALID_DATE')).toBe('autodial.workspace.importErrors.date');
  });
  it('keeps arbitrary server text out of the translated message', () => {
    expect(autodialImportErrorKey('row_invalid', 'secret stack')).toBe('autodial.workspace.importErrors.rowInvalid');
    expect(autodialImportErrorKey('existing_duplicate_external_id')).toBe('autodial.workspace.importErrors.existingExternalId');
  });
});
