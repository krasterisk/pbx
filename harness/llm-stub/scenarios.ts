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
    id: 'plan-reception',
    turns: [
      {
        toolCalls: [{
          id: 'call_plan_reception',
          name: 'propose_plan',
          arguments: {
            title: 'Приёмная',
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
                args: { name: 'Приёмная', exten: '9032' },
              },
              {
                id: 'ivr',
                tool: 'create_ivr',
                dependsOn: ['group'],
                args: { name: 'Приёмная' },
              },
            ],
          },
        }],
      },
      {
        text: 'Подтвердите план: абоненты 321–323, группа и IVR Приёмная.',
      },
    ],
  },
  {
    id: 'plan-queues',
    turns: [
      {
        toolCalls: [{
          id: 'call_plan_queues',
          name: 'propose_plan',
          arguments: {
            title: 'Контакт-центр',
            steps: [
              {
                id: 'sales',
                tool: 'create_queue',
                args: { name: 'Sales', exten: '8001' },
              },
              {
                id: 'support',
                tool: 'create_queue',
                args: { name: 'Support', exten: '8002' },
              },
              {
                id: 'ivr',
                tool: 'create_ivr',
                dependsOn: ['sales', 'support'],
                args: { name: 'Контакт-центр' },
              },
            ],
          },
        }],
      },
      {
        text: 'Подтвердите план: очереди Sales и Support, IVR контакт-центра.',
      },
    ],
  },
  {
    id: 'plan-trunk',
    turns: [
      {
        toolCalls: [{
          id: 'call_plan_trunk',
          name: 'propose_plan',
          arguments: {
            title: 'Транк и справочник',
            steps: [
              {
                id: 'directory',
                tool: 'create_directory',
                args: { name: 'VIP', lookupFieldKey: 'num' },
              },
              {
                id: 'trunk',
                tool: 'create_trunk',
                args: { name: 'MTT', host: 'sip.mtt.example' },
              },
              {
                id: 'endpoints',
                tool: 'create_endpoints_bulk',
                args: { extensionsPattern: '201-202' },
              },
            ],
          },
        }],
      },
      {
        text: 'Подтвердите план: справочник VIP, транк MTT, абоненты 201–202.',
      },
    ],
  },
  {
    id: 'plan-horns-hooves',
    turns: [
      {
        toolCalls: [{
          id: 'call_list_tts',
          name: 'list_tts_engines',
          arguments: { name: 'ivrs' },
        }],
      },
      {
        toolCalls: [{
          id: 'call_list_endpoints',
          name: 'list_endpoints',
          arguments: { extensions: '101-103' },
        }],
      },
      {
        toolCalls: [{
          id: 'call_list_endpoints_again',
          name: 'list_endpoints',
          arguments: { extensions: '101-103' },
        }],
      },
      {
        toolCalls: [{
          id: 'call_propose_horns',
          name: 'propose_plan',
          arguments: {
            title: 'IVR «Рога и копыта»',
            steps: [
              {
                id: 'endpoints',
                tool: 'create_endpoints_bulk',
                args: {
                  extensionsPattern: '101-103',
                  displayNamePattern: 'Абонент {N}',
                },
              },
              {
                id: 'group',
                tool: 'create_call_group',
                dependsOn: ['endpoints'],
                args: {
                  name: 'Рога и копыта',
                  exten: '6917',
                  strategy: 'ringall',
                  members: [
                    { member_type: 'internal', value: '101' },
                    { member_type: 'internal', value: '102' },
                    { member_type: 'internal', value: '103' },
                  ],
                },
              },
              {
                id: 'ivr',
                tool: 'create_ivr',
                dependsOn: ['group'],
                args: {
                  name: 'Рога и копыта',
                  text: 'Здравствуйте, вы позвонили в Рога и копыта. Нажмите 1 для консультации, 2 для ремонта, 3 для гарантии, или оставайтесь на линии',
                  menu_items: [
                    { digit: '1', destination: { kind: 'extension', target: '101' } },
                    { digit: '2', destination: { kind: 'extension', target: '102' } },
                    { digit: '3', destination: { kind: 'extension', target: '103' } },
                    { digit: 't', destination: { kind: 'group', target: '6917' } },
                  ],
                },
              },
            ],
          },
        }],
      },
      {
        text: 'Подтвердите план: меню «Рога и копыта», кнопки 1–3 на 101–103, таймаут — группа ringall.',
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
