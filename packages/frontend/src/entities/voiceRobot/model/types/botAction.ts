/**
 * Voice Robot Bot Action types (Frontend mirror of backend bot-action.types.ts).
 *
 * Used in VoiceRobotActionEditor to define per-keyword behavior:
 * response → slots → nextState
 */

// ─── Bot Response ────────────────────────────────────────

export type BotResponseType = 'none' | 'tts' | 'prompt';

export interface IBotResponse {
  type: BotResponseType;
  value?: string;
}

// ─── Bot Next State ──────────────────────────────────────

export type BotNextStateType =
  | 'listen'
  | 'switch_group'
  | 'transfer_queue'
  | 'transfer_exten'
  | 'webhook'
  | 'hangup';

export interface IBotNextState {
  type: BotNextStateType;
  target?: string | number;
}

// ─── Slot Definition ─────────────────────────────────────

export type SlotType = 'digits' | 'phone' | 'yes_no' | 'date' | 'choice' | 'freetext';

export interface ISlotChoice {
  value: string;
  label?: string;
  synonyms: string[];
}

export interface ISlotDefinition {
  name: string;
  type: SlotType;
  prompt: IBotResponse;
  choices?: ISlotChoice[];
  maxRetries?: number;
  retryPrompt?: IBotResponse;
  validationPattern?: string;
}

// ─── Bot Action (Unified) ────────────────────────────────

export interface IVoiceRobotBotAction {
  response: IBotResponse;
  nextState: IBotNextState;
  slots?: ISlotDefinition[];
  webhookPayload?: Record<string, string>;
  webhookResponseTemplate?: string;
  webhookAuth?: {
    mode: 'none' | 'bearer' | 'custom';
    token?: string;
    customHeaders?: { key: string; value: string }[];
  };
  dtmfAlternative?: string;
  delayMs?: number;
}

// ─── Constants ───────────────────────────────────────────

export const NEXT_STATE_OPTIONS: { value: BotNextStateType; labelKey: string; fallback: string }[] = [
  { value: 'listen', labelKey: 'voiceRobots.action.listen', fallback: 'Продолжить слушать' },
  { value: 'switch_group', labelKey: 'voiceRobots.action.switchGroup', fallback: 'Переключить группу' },
  { value: 'transfer_queue', labelKey: 'voiceRobots.action.transferQueue', fallback: 'Перевод на очередь' },
  { value: 'transfer_exten', labelKey: 'voiceRobots.action.transferExten', fallback: 'Перевод на номер' },
  { value: 'webhook', labelKey: 'voiceRobots.action.webhook', fallback: 'Webhook запрос' },
  { value: 'hangup', labelKey: 'voiceRobots.action.hangup', fallback: 'Завершить звонок' },
];

export const SLOT_TYPE_OPTIONS: { value: SlotType; labelKey: string; fallback: string }[] = [
  { value: 'digits', labelKey: 'voiceRobots.slot.digits', fallback: 'Цифры' },
  { value: 'phone', labelKey: 'voiceRobots.slot.phone', fallback: 'Телефон' },
  { value: 'yes_no', labelKey: 'voiceRobots.slot.yesNo', fallback: 'Да/Нет' },
  { value: 'date', labelKey: 'voiceRobots.slot.date', fallback: 'Дата' },
  { value: 'choice', labelKey: 'voiceRobots.slot.choice', fallback: 'Выбор из списка' },
  { value: 'freetext', labelKey: 'voiceRobots.slot.freetext', fallback: 'Свободный текст' },
];

export const RESPONSE_TYPE_OPTIONS: { value: BotResponseType; labelKey: string; fallback: string }[] = [
  { value: 'none', labelKey: 'voiceRobots.response.none', fallback: 'Без ответа' },
  { value: 'tts', labelKey: 'voiceRobots.response.tts', fallback: 'TTS (Синтез речи)' },
  { value: 'prompt', labelKey: 'voiceRobots.response.prompt', fallback: 'Аудио-промпт' },
];
