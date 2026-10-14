/** Table registration/status copy; composed without changing the trunk form dictionary. */
export const trunkRegistrationRu = {
  registrationLabel: 'Регистрация',
  reachabilityLabel: 'Связь с провайдером',
  statusUnregistered: 'Не зарегистрирован',
  statusStopped: 'Регистрация остановлена',
  reachabilityNoContacts: 'Нет контакта для проверки',
  refreshRegistration: 'Обновить регистрацию',
  refreshSelectedRegistration: 'Обновить регистрацию выбранных',
  registrationNoEligible: 'У выбранных транков нет исходящей регистрации',
  registrationInProgress: 'Запрос регистрации выполняется',
  registrationRequested: 'Запрос регистрации отправлен',
  registrationRequestedCount: 'Запросы регистрации отправлены: {{count}}',
  registrationFailed: 'Не удалось запросить регистрацию',
  registrationFailedCount: 'Не удалось запросить регистрацию: {{count}}',
  registrationSkippedCount: 'Транки без исходящей регистрации пропущены: {{count}}',
};

export const trunkRegistrationEn: Record<keyof typeof trunkRegistrationRu, string> = {
  registrationLabel: 'Registration',
  reachabilityLabel: 'Provider connectivity',
  statusUnregistered: 'Unregistered',
  statusStopped: 'Registration stopped',
  reachabilityNoContacts: 'No contact to check',
  refreshRegistration: 'Refresh registration',
  refreshSelectedRegistration: 'Refresh selected registrations',
  registrationNoEligible: 'Selected trunks have no outbound registration',
  registrationInProgress: 'Registration request in progress',
  registrationRequested: 'Registration requested',
  registrationRequestedCount: 'Registration requests sent: {{count}}',
  registrationFailed: 'Could not request registration',
  registrationFailedCount: 'Registration requests failed: {{count}}',
  registrationSkippedCount: 'Trunks without outbound registration skipped: {{count}}',
};
