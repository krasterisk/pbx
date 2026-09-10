export type TurnCloseKind = 'question' | 'wait_confirm' | 'complete' | 'incomplete';

const FUTURE_WORK =
  /давайте (созда|провер|сдела|посмотр)|нужно создать|для этого нужно|сначала |начну |по шагам|шаг\s*\d|затем (провер|созда|добавл|сдела)|сейчас (провер|посмотр|созда|сдела)|теперь (созда|сдела|добавл|провер)|создам( сам)?|создадим|массово|через bulk|create_endpoints_bulk|create_ivr|menu_items|осталось (созда|сдела)|выполняю следующий|далее |let me (check|look|create|inspect)|i(?:'|’)?ll (check|look|create)|going to (check|create|look)/i;

const PLANNING_NARRATION =
  /пользователь просит|судя по документации|обычно это делается|обычно создают|мне нужно|для timeout|digit\s*=|goto\(|implicit action/i;

const SCHEMA_TALK_FLAGS = [
  /create_call_group/i,
  /create_ivr/i,
  /update_ivr/i,
  /propose_plan/i,
  /create_endpoints_bulk/i,
  /menu_items/i,
  /destination\.kind/i,
  /kind:\s*["']group/i,
  /exten\s*=/i,
  /inputSchema/i,
];

const SCHEMA_CONFESSION =
  /должен быть строк|expected string|параметр \S+ должен|в описании (?:update_|create_|propose_)|string or number/i;

const WAIT_CONFIRM =
  /подтверд(ите|ить|ение)? (карточк|создан)|подтвердите карточк|нажмите «?подтверд|карточка (на экране|готова)|ask the user to confirm/i;

const QUESTION_START = /^\s*(уточн|какой |какая |какие |куда |что именно|какой номер)/i;

const IVR_KIND = /ivr|голосовое меню|\bменю\b/i;
const ENDPOINT_KIND = /абонент|endpoint|внутренн/i;
const GROUP_KIND = /групп|timeout|таймаут|ничего не нажал|не нажал|оставайтесь на линии|остаться на линии|звонят все|ringall/i;

/** Two or more PBX entity kinds in one brief → one workflow card, not a series of create_*. */
export function looksLikeMultiEntitySetup(message: string): boolean {
  const value = message.trim();
  if (!value) return false;
  let kinds = 0;
  if (IVR_KIND.test(value)) kinds += 1;
  if (ENDPOINT_KIND.test(value) || (/\b\d{2,4}\b/.test(value) && (IVR_KIND.test(value) || GROUP_KIND.test(value)))) {
    kinds += 1;
  }
  if (GROUP_KIND.test(value)) kinds += 1;
  return IVR_KIND.test(value) && kinds >= 2;
}

export function looksTruncated(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (/["{\[,:\\]$/.test(value)) return true;
  if (/\bи т$/i.test(value)) return true;
  if (/digit может быть/i.test(value) && !/[.!?…]$/.test(value)) return true;
  return false;
}

export function looksLikeInternalReasoning(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (SCHEMA_CONFESSION.test(value)) return true;
  const hits = SCHEMA_TALK_FLAGS.filter((flag) => flag.test(value)).length;
  if (hits >= 2) return true;
  return hits >= 1 && value.length > 180;
}

export function looksLikePlanningNarration(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (looksLikeInternalReasoning(value)) return true;
  if (PLANNING_NARRATION.test(value)) return true;
  if (FUTURE_WORK.test(value) && value.length > 160) return true;
  return false;
}

function isClosingQuestion(value: string): boolean {
  if (looksLikePlanningNarration(value) || looksTruncated(value) || FUTURE_WORK.test(value)) {
    return false;
  }
  if (QUESTION_START.test(value)) return true;
  if (!/[?？]/.test(value)) return false;
  if (value.length <= 280) return true;
  const parts = value.split(/(?<=[.!?？…])/).map((part) => part.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  return /[?？]/.test(last) && last.length <= 200;
}

/**
 * A text-only completion may close the turn only as question, wait_confirm, or complete.
 * Narrated next steps, truncated provider replies and empty replies are incomplete.
 */
export function classifyTurnClose(text: string, opts: {
  hadProposal?: boolean;
  truncated?: boolean;
} = {}): TurnCloseKind {
  const value = text.trim();
  if (!value) return 'incomplete';
  if (opts.truncated || looksTruncated(value)) return 'incomplete';

  if (isClosingQuestion(value)) return 'question';
  if (WAIT_CONFIRM.test(value) || (opts.hadProposal && /подтверд/i.test(value))) return 'wait_confirm';
  if (FUTURE_WORK.test(value) || looksLikePlanningNarration(value)) return 'incomplete';
  if (opts.hadProposal) return 'incomplete';
  return 'complete';
}

export function incompleteReminder(locale?: string, skillNames: string[] = []): string {
  const ru = (locale ?? 'ru').toLowerCase().startsWith('ru');
  const prefersIvr = skillNames.includes('ivrs');
  const tools = prefersIvr
    ? 'list_endpoints → list_call_groups → list_tts_engines → create_ivr'
    : 'create_ivr / list_call_groups / list_endpoints';
  return ru
    ? `Не описывай шаги и не продолжай оборванный текст. Пустой ответ без tool call запрещён. Сразу вызови инструмент (${tools}). Вопрос — только если факта нет ни в одной реплике треда. Уже названный текст, цифры и номера не переспрашивай. Либо попроси подтвердить карточку.`
    : `Do not narrate steps or continue a truncated draft. An empty reply without a tool call is forbidden. Call a tool now (${tools}). Ask only a fact missing from every user message in this thread. Do not re-ask a named greeting, digits or members. Or ask the user to confirm the card.`;
}

export function forcedTurnStatus(opts: {
  locale?: string;
  hadProposal?: boolean;
  lastAssistant?: string;
}): string {
  const ru = (opts.locale ?? 'ru').toLowerCase().startsWith('ru');
  if (ru) {
    const card = opts.hadProposal
      ? 'На экране есть карточка подтверждения — нажмите «Подтвердить», затем напишите «продолжи».'
      : 'Повторите запрос или уточните недостающий номер / назначение.';
    const last = publicLastAssistant(opts.lastAssistant)
      ? `Последний шаг: ${publicLastAssistant(opts.lastAssistant)}`
      : 'Агент остановился без вызова инструмента.';
    return `${last}\nЧто сделать: ${card}`;
  }
  const card = opts.hadProposal
    ? 'A confirmation card is on screen — press Confirm, then say continue.'
    : 'Repeat the request or name the missing number or destination.';
  const last = publicLastAssistant(opts.lastAssistant)
    ? `Last step: ${publicLastAssistant(opts.lastAssistant)}`
    : 'The agent stopped without calling a tool.';
  return `${last}\nWhat to do: ${card}`;
}

function publicLastAssistant(text?: string): string {
  const value = text?.trim() ?? '';
  if (!value || looksLikePlanningNarration(value) || looksLikeInternalReasoning(value)) return '';
  return value.slice(0, 240);
}
