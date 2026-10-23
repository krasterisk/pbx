/** API diagnostics stay on the server; phone UI uses translated, actionable messages. */
export function phoneSessionErrorKey(reason: unknown): string {
  const value = reason as { status?: number | string; data?: { message?: unknown } } | null;
  const message = typeof value?.data?.message === 'string' ? value.data.message : '';
  const messages: Record<string, string> = {
    Unauthorized: 'authorizationRequired',
    'Invalid telephone number': 'invalidNumber', 'Invalid extension': 'invalidNumber',
    'Telephone access denied': 'accessDenied', 'Endpoint belongs to another organisation': 'accessDenied',
    'Telephone not found': 'telephoneNotFound',
    'Phone ownership unavailable': 'serverUnavailable', 'Cannot verify telephone availability': 'availabilityUnknown',
    'Telephone has an active call': 'activeCall', 'A call is being started': 'callStarting',
    'Use the active call-centre session or close it first': 'activeCallCenter',
    'Disconnect the ordinary telephone session first': 'sessionConflict',
    'A telephone session is already active; disconnect it first': 'sessionConflict',
    'Telephone already in use': 'sessionConflict',
    'Desk telephone is not registered or its availability cannot be verified': 'deskUnavailable',
    'Browser telephone is not configured': 'browserNotConfigured', 'Not a browser telephone': 'browserNotConfigured',
    'Telephone session expired or belongs to another window': 'sessionLost',
    'Telephone dialplan is not configured': 'dialplanNotConfigured',
  };
  const key = messages[message] || (value?.status === 401 ? 'authorizationRequired'
    : value?.status === 403 ? 'accessDenied' : value?.status === 404 ? 'telephoneNotFound'
      : value?.status === 409 ? 'sessionConflict'
        : value?.status === 'FETCH_ERROR' || value?.status === 'TIMEOUT_ERROR' || Number(value?.status) >= 500 ? 'serverUnavailable' : 'operationFailed');
  return `phoneNumber.${key}`;
}
