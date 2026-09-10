/** Чем ассистент закрыл ход. `incomplete` элементом не становится — ход не закрывается. */
export type AgentTurnCloseKind = 'question' | 'wait_confirm' | 'complete';

/** Видимость строки истории. `internal` не попадает в ленту и не уходит в браузер. */
export type AgentItemVisibility = 'public' | 'internal';

export interface AgentTimelineUserItem {
  kind: 'user';
  /** Стабильный id для React-ключа и upsert в кэш. Для строк БД — `m<uid>`. */
  id: string;
  text: string;
  createdAt: string;
}

export interface AgentTimelineAssistantItem {
  kind: 'assistant';
  id: string;
  text: string;
  closeKind: AgentTurnCloseKind;
  /** true, пока ход не закрыт: пузырь дописывается чанками. */
  streaming?: boolean;
  createdAt: string;
}

/** Один шаг работы: человеческая формулировка, без имени инструмента и аргументов. */
export interface AgentTimelineStepItem {
  kind: 'step';
  id: string;
  /** Ключ локали, например `aiChat.progress.tools.list_queues`. Текст выбирает фронтенд. */
  labelKey: string;
  /** Готовый текст на случай отсутствия ключа в локали. */
  labelFallback: string;
  /** Ключ локали с человеческим итогом шага (без JSON и имён инструментов). */
  detailKey?: string;
  detailFallback?: string;
  done: boolean;
  createdAt: string;
}

export interface AgentTimelineProposalItem {
  kind: 'proposal';
  id: string;
  /** `single` — DiffConfirmCard, `workflow` — WorkflowPlanCard. */
  card: 'single' | 'workflow';
  createdAt: string;
}

export type AgentTimelineItem =
  | AgentTimelineUserItem
  | AgentTimelineAssistantItem
  | AgentTimelineStepItem
  | AgentTimelineProposalItem;

export const AGENT_TIMELINE_KINDS = ['user', 'assistant', 'step', 'proposal'] as const;

/** Snake_case tool ids (`create_endpoints_bulk`) must never reach the chat. */
export function scrubToolIdsFromPublicText(text: string): string {
  return String(text ?? '')
    .replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.!?:;])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Chat text that means “apply the pending card”, not a new brief. */
export function looksLikeUserConfirm(message: string): boolean {
  const text = String(message ?? '').trim().toLowerCase();
  if (!text) return false;
  if (/(^|[\s,!.])не\s+(подтверж|согласен|согласна)/.test(text)) return false;
  if (/\?/.test(text)) return false;
  // JS `\b` is ASCII-only — do not use it after Cyrillic verbs.
  const confirm =
    /^(да[,!.\s]*)?(подтверждаю|подтвердить|подтвердите|согласен|согласна|делай|применяй|apply)([,!.\s]+(делай|применяй|план|карточку))*[,!.\s]*$/;
  return confirm.test(text) || /^(ок|ok)[,!.\s]+делай[,!.\s]*$/.test(text);
}

function stepSignature(item: AgentTimelineStepItem): string {
  return [
    item.labelKey,
    item.done ? '1' : '0',
    item.detailKey ?? '',
    item.detailFallback ?? '',
  ].join('|');
}

/** Consecutive identical steps (same label + outcome) collapse to the latest one. */
export function collapseDuplicateAgentSteps(items: AgentTimelineItem[]): AgentTimelineItem[] {
  const next: AgentTimelineItem[] = [];
  for (const item of items) {
    const prev = next[next.length - 1];
    if (item.kind === 'step' && prev?.kind === 'step' && stepSignature(prev) === stepSignature(item)) {
      next[next.length - 1] = item;
      continue;
    }
    next.push(item);
  }
  return next;
}
