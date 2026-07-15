/**
 * Channel-var message templates for the Notify dialplan app (D-13).
 * Values are Asterisk templates — do not include SHELL/SYSTEM/AGI (backend sanitizeTemplate).
 */
export const NOTIFY_PRESETS = {
  incomingCall: 'Входящий звонок от ${CALLERID(num)} на ${EXTEN}',
  missedCall: 'Пропущенный звонок от ${CALLERID(num)} на ${EXTEN}',
  answeredCall: 'Звонок принят: ${CALLERID(num)} → ${EXTEN} (длительность ${CDR(duration)}с)',
  hungupCall: 'Звонок завершён: ${CALLERID(num)} → ${EXTEN}, статус ${DIALSTATUS}',
} as const;

export type NotifyPresetKey = keyof typeof NOTIFY_PRESETS;

export const NOTIFY_PRESET_KEYS = Object.keys(NOTIFY_PRESETS) as NotifyPresetKey[];

export const NOTIFY_PRESET_LABEL_KEYS: Record<NotifyPresetKey, string> = {
  incomingCall: 'routes.apps.notify.presets.incomingCall',
  missedCall: 'routes.apps.notify.presets.missedCall',
  answeredCall: 'routes.apps.notify.presets.answeredCall',
  hungupCall: 'routes.apps.notify.presets.hungupCall',
};
