import type { AgentTimelineItem, AgentTurnCloseKind } from '@krasterisk/shared';

export interface TimelineSourceRow {
  uid: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_name?: string | null;
  proposal_id?: string | null;
  close_kind?: AgentTurnCloseKind | null;
  visibility?: string | null;
  created_at: Date | string;
}

export interface TimelineProposalRef {
  proposalId: string;
  card: 'single' | 'workflow';
}

export interface BuildTimelineOptions {
  /** proposal_id → вид карточки. Строка без записи в мапе элементом не станет. */
  proposals: Map<string, TimelineProposalRef>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function progressLabelKey(toolName: string): string {
  return `aiChat.progress.tools.${toolName}`;
}

export function buildTimeline(rows: TimelineSourceRow[], opts: BuildTimelineOptions): AgentTimelineItem[] {
  const items: AgentTimelineItem[] = [];

  for (const source of rows) {
    if (source.role === 'system') {
      continue;
    }

    if (source.role === 'user') {
      if (source.visibility === 'internal') {
        continue;
      }
      items.push({
        kind: 'user',
        id: `m${source.uid}`,
        text: source.content ?? '',
        createdAt: toCreatedAtIso(source.created_at),
      });
      continue;
    }

    if (source.role === 'assistant') {
      if (source.visibility === 'internal') {
        continue;
      }
      const text = source.content ?? '';
      if (!text.trim()) {
        continue;
      }
      items.push({
        kind: 'assistant',
        id: `m${source.uid}`,
        text,
        closeKind: source.close_kind ?? 'complete',
        createdAt: toCreatedAtIso(source.created_at),
      });
      continue;
    }

    if (source.tool_name === 'read_skill') {
      continue;
    }

    const toolName = source.tool_name ?? '';
    items.push({
      kind: 'step',
      id: `m${source.uid}`,
      labelKey: progressLabelKey(toolName),
      labelFallback: toolName,
      done: true,
      createdAt: toCreatedAtIso(source.created_at),
    });

    const proposalId = source.proposal_id;
    if (!proposalId) {
      continue;
    }
    const proposal = opts.proposals.get(proposalId);
    if (!proposal) {
      continue;
    }
    items.push({
      kind: 'proposal',
      id: `p${source.uid}`,
      card: proposal.card,
      createdAt: toCreatedAtIso(source.created_at),
    });
  }

  return items;
}

function toCreatedAtIso(createdAt: Date | string): string {
  if (createdAt instanceof Date) {
    return createdAt.toISOString();
  }
  if (ISO_DATE.test(createdAt)) {
    return createdAt;
  }
  return new Date(createdAt).toISOString();
}
