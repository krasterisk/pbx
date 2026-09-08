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
  {
    id: 'plan-ivr',
    turns: [
      {
        toolCalls: [{
          id: 'call_propose_plan',
          name: 'propose_plan',
          arguments: {
            title: 'IVR Приёмная',
            steps: [
              {
                id: 'endpoints',
                tool: 'create_endpoints_bulk',
                args: { extensionsPattern: '321-323' },
              },
              {
                id: 'group',
                tool: 'create_call_group',
                dependsOn: ['endpoints'],
                args: {
                  name: 'Приёмная',
                  exten: '9032',
                },
              },
              {
                id: 'ivr',
                tool: 'create_ivr',
                dependsOn: ['group'],
                args: {
                  name: 'Приёмная',
                },
              },
            ],
          },
        }],
      },
      {
        text: 'Подтвердите план: абоненты 321–323, группа на таймаут, меню Приёмная.',
      },
    ],
  },
  {
    id: 'question-order',
    turns: [{ text: 'Какой номер использовать для группы?' }],
  },
  {
    id: 'steps-then-answer',
    turns: [
      {
        toolCalls: [{ id: 'call_list_queues', name: 'list_queues', arguments: {} }],
      },
      {
        reasoning: 'сначала посмотрю',
        text: 'Очередей нет.',
      },
    ],
  },
];
