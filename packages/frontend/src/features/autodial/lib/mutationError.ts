/** Only display known, localized errors. Never render raw SQL/provider messages. */
export function autodialErrorKey(error: unknown, fallback: string): string {
  const data = (error as { data?: { code?: unknown } } | undefined)?.data;
  const code = data?.code;
  const supported = [
    "AC_REVISION_CONFLICT",
    "AC_CAMPAIGN_REVISION_CONFLICT",
    "AC_BASE_IN_USE",
    "AC_SCHEMA_IN_USE",
    "AC_FIELD_IN_USE",
    "AC_FIELD_KEY_IN_USE",
    "AC_CONTACT_IN_USE",
    "AC_PHONE_IN_USE",
    "AC_PHONE_UID",
    "AC_IMPORT_NO_VALID_ROWS",
    "AC_IMPORT_REPLACE_ERRORS",
    "AC_INVALID_ENUM",
    "AC_INVALID_DATE",
    "AC_INVALID_NUMBER",
    "AC_INVALID_BOOL",
    "AC_REQUIRED_FIELD",
    "AC_DUPLICATE_PHONE",
    "AC_FIELD_UID",
    "AC_DIALPLAN_APPLY_FAILED",
    "AC_AMD_UNAVAILABLE",
    "AC_AMD_MESSAGE_NOT_CONFIGURED",
  ];
  return typeof code === "string" && supported.includes(code)
    ? `autodial.errors.${code}`
    : fallback;
}
