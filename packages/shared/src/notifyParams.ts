/** Read legacy notification text without mutating the saved action. New edits use body. */
export function normalizeNotifyParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(params, 'message')) return params;
  const { message, ...canonical } = params;
  return canonical.body === undefined ? { ...canonical, body: message } : canonical;
}
