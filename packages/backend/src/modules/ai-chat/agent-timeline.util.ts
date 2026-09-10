import {
  collapseDuplicateAgentSteps,
  scrubToolIdsFromPublicText,
  type AgentTimelineItem,
  type AgentTurnCloseKind,
} from '@krasterisk/shared';
import { looksLikePlanningNarration } from './turn-outcome.util';

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

export function isToolErrorContent(content: string | null | undefined): boolean {
  if (!content) return false;
  return (
    content.startsWith('Ошибка:')
    || /"error"\s*:/.test(content)
    || /WORKFLOW_/.test(content)
    || content.includes('batch_required')
    || /"refused"\s*:\s*true/.test(content)
  );
}

export function humanStepDetail(
  toolName: string,
  content: string | null | undefined,
): { detailKey?: string; detailFallback?: string } | null {
  if (isToolErrorContent(content)) {
    if (toolName === 'propose_plan' || /WORKFLOW_/.test(content ?? '')) {
      return { detailKey: 'aiChat.progress.detail.planFailed' };
    }
    return { detailKey: 'aiChat.progress.detail.stepFailed' };
  }
  const parsed = parseJsonObject(content);
  if (!parsed) return null;
  if (toolName === 'list_endpoints') {
    const numbers = namesFrom(parsed.endpoints ?? parsed.items, ['extension', 'name']);
    const missing = Array.isArray(parsed.missing)
      ? parsed.missing.map((value) => String(value)).filter(Boolean)
      : [];
    if (numbers.length && missing.length) {
      return { detailFallback: `Есть: ${numbers.slice(0, 8).join(', ')}. Нет: ${missing.slice(0, 8).join(', ')}` };
    }
    if (numbers.length) {
      return { detailFallback: `Абоненты: ${numbers.slice(0, 8).join(', ')}` };
    }
    if (missing.length) {
      return { detailFallback: `Абонентов нет: ${missing.slice(0, 8).join(', ')}` };
    }
    return { detailFallback: 'Абонентов с такими номерами нет' };
  }
  if (toolName === 'list_tts_engines') {
    const names = namesFrom(parsed.engines, ['name']);
    return names.length
      ? { detailFallback: `Движки: ${names.slice(0, 5).join(', ')}` }
      : { detailFallback: 'Голосовых движков нет' };
  }
  if (toolName === 'list_call_groups') {
    const names = namesFrom(parsed.groups ?? parsed.items, ['name', 'exten']);
    return names.length ? { detailFallback: `Группы: ${names.slice(0, 6).join(', ')}` } : null;
  }
  if (toolName === 'list_dialplan_apps') {
    const types = namesFrom(parsed.apps, ['type']);
    return types.length
      ? { detailFallback: `Приложения: ${types.slice(0, 8).join(', ')}` }
      : { detailFallback: 'Приложений маршрутизации нет' };
  }
  return null;
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
      const text = scrubToolIdsFromPublicText(source.content ?? '');
      if (!text.trim() || looksLikePlanningNarration(text)) {
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
    const detail = humanStepDetail(toolName, source.content);
    items.push({
      kind: 'step',
      id: `m${source.uid}`,
      labelKey: progressLabelKey(toolName),
      labelFallback: toolName,
      ...(detail?.detailKey ? { detailKey: detail.detailKey } : {}),
      ...(detail?.detailFallback ? { detailFallback: detail.detailFallback } : {}),
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

  return collapseDuplicateAgentSteps(items);
}

function parseJsonObject(content: string | null | undefined): Record<string, unknown> | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function namesFrom(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    for (const key of keys) {
      const text = rec[key];
      if (typeof text === 'string' && text.trim() && !/^\d+$/.test(key === 'uid' ? text : '')) {
        names.push(text.trim());
        break;
      }
      if ((key === 'extension' || key === 'exten') && (typeof text === 'string' || typeof text === 'number')) {
        names.push(String(text));
        break;
      }
    }
  }
  return names;
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
