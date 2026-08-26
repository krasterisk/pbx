/**
 * i18n helper used by label formatters.
 * Second argument is intentionally `any`: i18next `TFunction` overloads
 * (required defaultValue vs optional options) are incompatible with both
 * `t` and `(key, fallback?) => string` stubs under strictFunctionTypes.
 */
export type TranslateFn = (
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallbackOrOptions?: any,
) => string;
