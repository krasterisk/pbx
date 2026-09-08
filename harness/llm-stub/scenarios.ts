export interface StubToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface StubTurn {
  text?: string;
  reasoning?: string;
  toolCalls?: StubToolCall[];
}

export interface StubScenario {
  id: string;
  turns: StubTurn[];
}

export const STUB_SCENARIOS: StubScenario[] = [
  {
    id: 'two-turns',
    turns: [{ text: 'first' }, { text: 'second' }],
  },
  {
    id: 'with-reasoning',
    turns: [{ reasoning: 'сначала подумаю', text: 'ответ' }],
  },
  {
    id: 'with-tools',
    turns: [
      {
        text: 'calling',
        toolCalls: [{ id: 'call_1', name: 'list_queues', arguments: { limit: 10 } }],
      },
    ],
  },
];
