export type TurnCloseKind = 'question' | 'wait_confirm' | 'complete' | 'incomplete';

const FUTURE_WORK =
  /давайте (созда|провер|сдела|посмотр)|нужно создать|для этого нужно|сначала |начну |по шагам|шаг\s*\d|затем (провер|созда|добавл|сдела)|сейчас (провер|посмотр|созда|сдела)|теперь (созда|сдела|добавл|провер)|создам( сам)?|создадим|массово|через bulk|create_endpoints_bulk|create_ivr|menu_items|осталось (созда|сдела)|выполняю следующий|далее |let me (check|look|create|inspect)|i(?:'|’)?ll (check|look|create)|going to (check|create|look)/i;

const PLANNING_NARRATION =
  /пользователь просит|судя по документации|обычно это делается|обычно создают|мне нужно|для timeout|digit\s*=|goto\(|implicit action/i;

const WAIT_CONFIRM =
  /подтверд(ите|ить|ение)? (карточк|создан)|подтвердите карточк|нажмите «?подтверд|карточка (на экране|готова)|ask the user to confirm/i;

const QUESTION_START = /^\s*(уточн|какой |какая |какие |куда |что именно|какой номер)/i;

export function looksTruncated(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (/["{\[,:\\]$/.test(value)) return true;
  if (/\bи т$/i.test(value)) return true;
  if (/digit может быть/i.test(value) && !/[.!?…]$/.test(value)) return true;
  return false;
}

export function looksLikePlanningNarration(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
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
    const last = opts.lastAssistant?.trim()
      ? `Последний шаг: ${opts.lastAssistant.trim().slice(0, 240)}`
      : 'Агент остановился без вызова инструмента.';
    return `${last}\nЧто сделать: ${card}`;
  }
  const card = opts.hadProposal
    ? 'A confirmation card is on screen — press Confirm, then say continue.'
    : 'Repeat the request or name the missing number or destination.';
  const last = opts.lastAssistant?.trim()
    ? `Last step: ${opts.lastAssistant.trim().slice(0, 240)}`
    : 'The agent stopped without calling a tool.';
  return `${last}\nWhat to do: ${card}`;
}
