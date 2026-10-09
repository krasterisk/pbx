/** Product convention for user-supplied dialplan context identifiers. */
export const CONTEXT_IDENTIFIER_MAX_LENGTH = 64;
export const CONTEXT_IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[\-_][a-z0-9]+)*$/;
export const CONTEXT_IDENTIFIER_ERROR = 'Context identifier must be 1–64 characters: start with a lowercase Latin letter, use lowercase Latin letters and digits, with single hyphens or underscores between parts';
export function isContextIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length <= CONTEXT_IDENTIFIER_MAX_LENGTH && CONTEXT_IDENTIFIER_PATTERN.test(value);
}
