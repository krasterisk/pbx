import { buildTimeline, progressLabelKey, type TimelineSourceRow } from './agent-timeline.util';

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
});
