export const SUPERVISOR_PATH = '/callcenter/supervisor';

export const SUPERVISOR_VIEWS = ['agents', 'calls', 'queues', 'history', 'callbacks'] as const;
export type SupervisorViewId = (typeof SUPERVISOR_VIEWS)[number];

export const SUPERVISOR_GROUPS = ['none', 'status', 'queue', 'team'] as const;
export type SupervisorGroupBy = (typeof SUPERVISOR_GROUPS)[number];

export const SUPERVISOR_SORTS = ['time', 'name', 'missed'] as const;
export type SupervisorSortBy = (typeof SUPERVISOR_SORTS)[number];

export interface SupervisorUrlState {
  view: SupervisorViewId;
  queues: string[];
  agentId: number | null;
  group: SupervisorGroupBy;
  sort: SupervisorSortBy;
}

const isView = (v: string | null): v is SupervisorViewId =>
  v !== null && (SUPERVISOR_VIEWS as readonly string[]).includes(v);

const isGroup = (v: string | null): v is SupervisorGroupBy =>
  v !== null && (SUPERVISOR_GROUPS as readonly string[]).includes(v);

const isSort = (v: string | null): v is SupervisorSortBy =>
  v !== null && (SUPERVISOR_SORTS as readonly string[]).includes(v);

export function parseSupervisorUrl(search: URLSearchParams): SupervisorUrlState {
  const viewRaw = search.get('view');
  const qRaw = search.get('q') ?? '';
  const queues = [
    ...new Set(
      qRaw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const agentRaw = search.get('agent');
  const parsedAgent = agentRaw !== null && /^\d+$/.test(agentRaw.trim()) ? Number(agentRaw.trim()) : null;
  const agentId = parsedAgent !== null && parsedAgent > 0 ? parsedAgent : null;
  const groupRaw = search.get('group');
  const sortRaw = search.get('sort');

  return {
    view: isView(viewRaw) ? viewRaw : 'agents',
    queues,
    agentId,
    group: isGroup(groupRaw) ? groupRaw : 'none',
    sort: isSort(sortRaw) ? sortRaw : 'time',
  };
}

export function buildSupervisorSearch(state: Partial<SupervisorUrlState>): string {
  const params = new URLSearchParams();
  if (state.view && state.view !== 'agents') {
    params.set('view', state.view);
  }
  const queues = (state.queues ?? []).map((q) => q.trim().toLowerCase()).filter(Boolean);
  if (queues.length > 0) {
    params.set('q', [...new Set(queues)].join(','));
  }
  if (state.agentId != null && state.agentId > 0) {
    params.set('agent', String(state.agentId));
  }
  if (state.group && state.group !== 'none') {
    params.set('group', state.group);
  }
  if (state.sort && state.sort !== 'time') {
    params.set('sort', state.sort);
  }
  return params.toString();
}

export function buildSupervisorLink(state: Partial<SupervisorUrlState> = {}): string {
  const qs = buildSupervisorSearch(state);
  return qs ? `${SUPERVISOR_PATH}?${qs}` : SUPERVISOR_PATH;
}
