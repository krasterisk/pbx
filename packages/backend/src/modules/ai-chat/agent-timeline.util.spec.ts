import { buildTimeline, humanStepDetail, progressLabelKey, type TimelineSourceRow } from './agent-timeline.util';

const at = '2026-09-08T10:00:00.000Z';
function row(partial: Partial<TimelineSourceRow> & Pick<TimelineSourceRow, 'uid' | 'role'>): TimelineSourceRow {
  return { content: null, created_at: at, ...partial };
}

const orderRows: TimelineSourceRow[] = [
  row({ uid: 1, role: 'user', content: 'Создай IVR' }),
  row({ uid: 2, role: 'assistant', content: '' }),
  row({ uid: 3, role: 'tool', tool_name: 'create_ivr', content: '{"proposalId":"x"}', proposal_id: 'x' }),
  row({ uid: 4, role: 'assistant', content: 'Подтвердите карточку', close_kind: 'wait_confirm' }),
];

const orderProposals = new Map([['x', { proposalId: 'x', card: 'single' as const }]]);

describe('buildTimeline', () => {
  it('maps a user row to a user item with a stable id', () => {
    const items = buildTimeline([row({ uid: 1, role: 'user', content: 'Создай IVR' })], { proposals: new Map() });
    expect(items).toEqual([{ kind: 'user', id: 'm1', text: 'Создай IVR', createdAt: at }]);
  });

  it('keeps the row order: user, step, proposal, assistant', () => {
    const items = buildTimeline(orderRows, { proposals: orderProposals });
    expect(items.map((i) => i.kind)).toEqual(['user', 'step', 'proposal', 'assistant']);
  });

  it('never exposes a tool result payload or a proposal id in an item', () => {
    const items = buildTimeline(orderRows, { proposals: orderProposals });
    const serialized = JSON.stringify(items);
    expect(serialized).not.toContain('proposalId');
    expect(serialized).not.toContain('{"proposalId":"x"}');
  });

  it('strips tool identifiers from a public assistant row', () => {
    const items = buildTimeline(
      [row({
        uid: 9,
        role: 'assistant',
        content: 'Отлично! create_endpoints_bulk подготовил черновик для 102 и 103.',
        close_kind: 'wait_confirm',
      })],
      { proposals: new Map() },
    );
    expect(items).toEqual([expect.objectContaining({
      kind: 'assistant',
      text: 'Отлично! подготовил черновик для 102 и 103.',
    })]);
  });

  it('skips internal assistant rows', () => {
    const items = buildTimeline(
      [row({ uid: 5, role: 'assistant', content: 'внутренний ход', visibility: 'internal' })],
      { proposals: new Map() },
    );
    expect(items).toEqual([]);
  });

  it('skips a read_skill step', () => {
    const items = buildTimeline(
      [row({ uid: 6, role: 'tool', tool_name: 'read_skill', content: '{"ok":true}' })],
      { proposals: new Map() },
    );
    expect(items).toEqual([]);
  });

  it('skips a system row', () => {
    const items = buildTimeline(
      [row({ uid: 7, role: 'system', content: 'системная строка' })],
      { proposals: new Map() },
    );
    expect(items).toEqual([]);
  });

  it('drops a proposal item when the proposal is unknown', () => {
    const items = buildTimeline(
      [row({ uid: 8, role: 'tool', tool_name: 'create_ivr', content: '{"proposalId":"x"}', proposal_id: 'x' })],
      { proposals: new Map() },
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'step', id: 'm8', done: true });
  });

  it('hides schema reasoning that leaked as a public assistant row', () => {
    const items = buildTimeline(
      [row({
        uid: 21,
        role: 'assistant',
        content:
          'Ой, в create_call_group параметр exten должен быть строкой. '
          + 'В описании update_ivr target может быть string or number.',
      })],
      { proposals: new Map() },
    );
    expect(items).toEqual([]);
  });

  it('defaults closeKind to complete when the column is empty', () => {
    const items = buildTimeline(
      [row({ uid: 9, role: 'assistant', content: 'Готово', close_kind: null })],
      { proposals: new Map() },
    );
    expect(items).toEqual([
      { kind: 'assistant', id: 'm9', text: 'Готово', closeKind: 'complete', createdAt: at },
    ]);
  });

  it('names a step by locale key, not by tool identifier', () => {
    expect(progressLabelKey('list_queues')).toBe('aiChat.progress.tools.list_queues');
  });

  it('maps a failed propose_plan to a human detail key without the raw payload', () => {
    expect(humanStepDetail('propose_plan', 'Ошибка: WORKFLOW_REFUSED:create_ivr:need name')).toEqual({
      detailKey: 'aiChat.progress.detail.planFailed',
    });
    const items = buildTimeline(
      [row({
        uid: 10,
        role: 'tool',
        tool_name: 'propose_plan',
        content: 'Ошибка: WORKFLOW_REFUSED:create_ivr:need name',
      })],
      { proposals: new Map() },
    );
    expect(items[0]).toMatchObject({
      kind: 'step',
      detailKey: 'aiChat.progress.detail.planFailed',
    });
    expect(JSON.stringify(items)).not.toContain('WORKFLOW_REFUSED');
    expect(JSON.stringify(items)).not.toContain('create_ivr');
  });

  it('keeps a concrete lookup summary and drops placeholder copy', () => {
    expect(humanStepDetail('list_endpoints', '{"endpoints":[{"extension":"101"},{"extension":"102"}]}'))
      .toEqual({ detailFallback: 'Абоненты: 101, 102' });
    expect(humanStepDetail('list_dialplan_apps', '{"apps":[{"type":"totrunk"},{"type":"togroup"}]}'))
      .toEqual({ detailFallback: 'Приложения: totrunk, togroup' });
    expect(humanStepDetail('create_endpoints_bulk', '{"ok":true}')).toBeNull();
  });

  it('collapses two identical consecutive plan steps', () => {
    const items = buildTimeline(
      [
        row({ uid: 11, role: 'tool', tool_name: 'propose_plan', content: 'Ошибка: WORKFLOW_REFUSED:x' }),
        row({ uid: 12, role: 'tool', tool_name: 'propose_plan', content: 'Ошибка: WORKFLOW_REFUSED:x' }),
      ],
      { proposals: new Map() },
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'step', id: 'm12' });
  });
});
