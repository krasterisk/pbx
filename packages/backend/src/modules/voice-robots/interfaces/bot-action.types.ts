/**
 * Voice Robot Bot Action — unified dialogue node definition.
 *
 * Describes what happens when a keyword is matched:
 * 1. What to say (response)
 * 2. What data to collect (slots / function calling)
 * 3. What to do next (navigation)
 */

// ─── Bot Action ──────────────────────────────────────────

export interface IVoiceRobotBotAction {
  /** 1. What to say in response */
  response: IBotResponse;

  /** 2. What to do next after response (and optional slot filling) */
  nextState: IBotNextState;

  /** 3. Parameters to collect before executing nextState (Function Calling) */
  slots?: ISlotDefinition[];

  /** 4. Webhook payload template (used when nextState.type === 'webhook') */
  webhookPayload?: Record<string, string>;

  /** 5. TTS template for webhook response (e.g. "Ваш баланс: {{balance}} рублей") */
  webhookResponseTemplate?: string;

  /** Webhook Authentication config */
  webhookAuth?: {
    mode: 'none' | 'bearer' | 'custom';
    token?: string;
    customHeaders?: { key: string; value: string }[];
  };

  /** 6. DTMF alternative (e.g. "1" — press 1 instead of saying a keyword) */
  dtmfAlternative?: string;

  /** 7. Delay before executing action (ms) */
  delayMs?: number;

  /** 8. Data list search configuration (used when nextState.type === 'search_data_list') */
  dataListSearch?: IDataListSearchConfig;
}

// ─── Data List Search Config ─────────────────────────────

export interface IDataListSearchConfig {
  /** Which data list to search (uid) */
  listId: number;
  /** Where to get search query from */
  querySource: 'last_utterance' | 'slot';
  /** Slot name to use as query (when querySource === 'slot') */
  querySlotName?: string;
  /** Which column to return from matched row (e.g. "phone") */
  returnField: string;
  /** Variable name to store result in dialogueContext (e.g. "manager_phone") */
  resultVariable: string;
  /** What to say if nothing found */
  notFoundResponse?: IBotResponse;
  /** What to say when found (before executing onFoundNextState, supports {{variable}} interpolation) */
  onFoundResponse?: IBotResponse;
  /** What to do after successful search */
  onFoundNextState?: IBotNextState;
  /** What to do after all not-found retries exhausted */
  notFoundNextState?: IBotNextState;
  /** How many not-found attempts before executing notFoundNextState (default: 1) */
  maxNotFoundRetries?: number;
  /** When multiple rows match: 'best' = highest confidence (default), 'random' = pick randomly */
  multiMatchStrategy?: 'best' | 'random';
}

// ─── Response ────────────────────────────────────────────

export interface IBotResponse {
  /** Response type */
  type: 'none' | 'tts' | 'prompt';
  /** Text for TTS synthesis, or prompt UID for playback */
  value?: string;
}

// ─── Next State ──────────────────────────────────────────

export interface IBotNextState {
  /**
   * Navigation action after response:
   * - listen:            Stay in current group, listen for next utterance
   * - switch_group:      Switch to another keyword group (in-session, no Stasis exit)
   * - transfer_exten:    Exit to Asterisk Extension/Queue via dialplan (terminal)
   * - webhook:           HTTP POST with collected slots, then TTS response (terminal)
   * - search_data_list:  Search a structured data list and store result in dialogueContext
   * - hangup:            Hang up the call (terminal)
   */
  type:
    | 'listen'
    | 'switch_group'
    | 'transfer_exten'
    | 'webhook'
    | 'search_data_list'
    | 'hangup';

  /**
   * Target identifier:
   * - switch_group:    keyword group UID
   * - transfer_exten:  extension or extension@context
   * - webhook:         URL
   */
  target?: string | number;
}

// ─── Slot Definition (Function Calling) ──────────────────

export interface ISlotDefinition {
  /** Unique slot name (used in webhook payload template) */
  name: string;

  /**
   * Slot extraction type:
   * - digits:   Verbal numbers → numeric string ("двенадцать тридцать" → "1230")
   * - phone:    Phone number extraction
   * - yes_no:   Boolean ("да"/"нет" → true/false)
   * - date:     Date extraction ("завтра", "15 апреля" → ISO date)
   * - choice:   Selection from predefined options
   * - freetext: Raw STT text (name, address, etc.)
   */
  type: 'digits' | 'phone' | 'yes_no' | 'date' | 'choice' | 'freetext';

  /** TTS/prompt to ask the caller for this slot */
  prompt: IBotResponse;

  /** For type='choice': list of valid options with synonyms */
  choices?: ISlotChoice[];

  /** Max retry attempts before fallback (default: 3) */
  maxRetries?: number;

  /** TTS/prompt for retry (e.g. "Не удалось распознать. Повторите.") */
  retryPrompt?: IBotResponse;

  /** Validation regex (optional, for digits/phone) */
  validationPattern?: string;
}

export interface ISlotChoice {
  /** Canonical value stored in the result */
  value: string;
  /** Display label for UI */
  label?: string;
  /** Synonyms that map to this value (e.g. ["тариф базовый", "первый", "начальный"]) */
  synonyms: string[];
}

// ─── Slot Extraction Result ──────────────────────────────

export interface ISlotExtractionResult {
  /** Whether the slot was successfully extracted */
  success: boolean;
  /** Extracted value (typed according to slot definition) */
  value?: string | boolean;
  /** Raw text from STT */
  rawText: string;
  /** Confidence of extraction (0.0–1.0) */
  confidence: number;
}
