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
