import { looksLikeMultiEntitySetup, looksLikeRouteSetup } from './turn-outcome.util';
import { isCdrAnswerTool } from './cdr-answer-links';

export type TurnMode = 'confirm' | 'clarify' | 'configure' | 'diagnose' | 'read';

export interface TurnModeDecision {
  mode: TurnMode;
  domain: string | null;
  missing: string[];
}

export const TURN_MODE_SYSTEM = [
  'Classify one PBX chat turn mode.',
  'Reply with JSON only: {"mode":"read|diagnose|configure|clarify","domain":string|null,"missing":string[]}.',
  'turn mode rules:',
  '- read: list, count, or show current state. No change.',
  '- diagnose: a complaint about a call, registration, route, or "why".',
  '- configure: create or change PBX entities.',
  '- clarify: the request is too vague to choose a mode. Put the one missing fact in missing[].',
  'domain is a short label such as autodial, ivr, route, queue, endpoints, diagnostics, or null.',
].join('\n');

const MODES = new Set<TurnMode>(['confirm', 'clarify', 'configure', 'diagnose', 'read']);

export const EVIDENCE_TOOLS = new Set([
  'describe_number',
  'get_compiled_dialplan',
  'find_cdr_calls',
  'get_recent_call_events',
  'evaluate_time_group',
  'get_endpoint_registration',
]);

/** Single-object reads stay intact. List payloads are still clipped. */
export const UNTRUNCATED_TOOLS = new Set([
  'get_autodial_campaign',
  'get_autodial_base',
  'describe_autodial_capabilities',
  'get_autodial_diagnosis',
  'get_autodial_preflight',
  'get_configuration_capabilities',
  'get_endpoint_configuration',
  'get_trunk_configuration',
  'get_queue_configuration',
  'describe_number',
  'get_compiled_dialplan',
  'get_endpoint_registration',
  'get_voice_robot_configuration',
  'export_voice_robot_scenario',
]);

const ROBOT_READ_TOOLS = new Set(['validate_voice_robot_scenario', 'check_voice_robot_readiness',
  'export_voice_robot_scenario', 'test_voice_robot_match', 'test_voice_robot_data_list']);

// Exact report reads only: broad search_/resolve_ prefixes could expose mutations.
const REPORT_READ_TOOLS = new Set(['search_calls', 'summarize_calls', 'get_cdr_summary',
  'resolve_call_employees', 'summarize_employee_calls', 'search_call_content', 'summarize_call_conversations']);

const READ_TOOL_NAME = /^(?:get_|list_|read_|find_|describe_|evaluate_|cc_get_|cc_list_|dialplan_dry_run$)/;

/** Preserve explicit global read-only instructions, while allowing an edit
 * with a scoped constraint such as "change description; don't change fields". */
export function isExplicitReadOnlyRequest(message: string): boolean {
  if (/ничего\s+не\s+(?:меня|изменя)|ничего\s+не\s+менять|только\s+(?:чтение|диагностик)|без\s+изменений|read.only/i.test(message)) return true;
  const negative = /не\s+(?:меняй|изменяй)/i.test(message);
  const positive = /(?:^|\s)(?:измени|изменить|обнови|создай|создать|настрой|change|update|create)\s/i.test(message);
  return negative && !positive;
}

const CAUSE_CLAIM = /причин|потому что|из-за|виноват|не зарегистрир|уходит на|не туда/i;

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(body.slice(start, end + 1));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseTurnModeDecision(raw: string): TurnModeDecision | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;
  const mode = parsed.mode;
  if (typeof mode !== 'string' || !MODES.has(mode as TurnMode)) return null;
  const domain = typeof parsed.domain === 'string' && parsed.domain.trim()
    ? parsed.domain.trim()
    : null;
  const missing = Array.isArray(parsed.missing)
    ? parsed.missing.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  return { mode: mode as TurnMode, domain, missing };
}

/** Regex hints for the mode call. They do not choose tools by themselves. */
export function turnModeHint(message: string): string {
  const hints: string[] = [];
  if (/обзвон|кампани|коллектор|должник|autodial/i.test(message)) hints.push('hint: autodial campaign/base/scenario, not a new IVR menu.');
  if (looksLikeRouteSetup(message)) {
    hints.push('hint: incoming route or schedule, not a new IVR menu.');
  }
  if (looksLikeMultiEntitySetup(message)) {
    hints.push('hint: one request names several PBX entities.');
  }
  if (/не меняй|не изменяй|ничего не менять|только диагностик|без изменений|read.only/i.test(message)) {
    hints.push('hint: user asked not to change settings.');
  }
  if (/почему|не работает|не проходит|жалоб|нет регистрац|не могу позвонить/i.test(message)) {
    hints.push('hint: support complaint.');
  }
  return hints.join('\n');
}

export function isReadToolName(name: string): boolean {
  return READ_TOOL_NAME.test(name) || ROBOT_READ_TOOLS.has(name) || REPORT_READ_TOOLS.has(name);
}

/** MCP discovery may exceed the provider's per-request tool limit. Keep discovery and the requested domains first. */
export function selectAgentToolBudget<T extends { name: string }>(tools: T[], preferredNames: string[], maximum = 128): T[] {
  if (tools.length <= maximum) return tools;
  const discovery = new Set(['get_configuration_capabilities', 'list_skills', 'read_skill', 'get_pbx_state', 'propose_plan']);
  const preferred = new Set(preferredNames);
  return [...tools.filter(t => discovery.has(t.name)), ...tools.filter(t => !discovery.has(t.name) && preferred.has(t.name)),
    ...tools.filter(t => !discovery.has(t.name) && !preferred.has(t.name))].slice(0, maximum);
}

export function toolsForMode<T extends { name: string }>(
  tools: T[],
  mode: TurnMode,
  readOnlyRequest: boolean,
): T[] {
  if (readOnlyRequest || mode === 'diagnose' || mode === 'read') {
    return tools.filter((tool) => isReadToolName(tool.name));
  }
  return tools;
}

export function providerHasNativeTools(provider: {
  capabilities?: string[] | null;
  vendor?: string | null;
  endpoint?: string | null;
}): boolean {
  const caps = provider.capabilities ?? [];
  return caps.includes('tools') || caps.includes('function_calling');
}

export function diagnoseNeedsEvidence(text: string, called: ReadonlySet<string>): boolean {
  if (!CAUSE_CLAIM.test(text)) return false;
  for (const name of EVIDENCE_TOOLS) {
    if (called.has(name)) return false;
  }
  return true;
}

export function evidenceReminder(locale?: string): string {
  const ru = (locale ?? 'ru').toLowerCase().startsWith('ru');
  return ru
    ? 'Не называй причину, пока нет улики в этом ходе. Вызови describe_number или get_compiled_dialplan, либо find_cdr_calls / get_recent_call_events по номеру из жалобы. Пустой или обрезанный список — не причина.'
    : 'Do not name a cause before evidence in this turn. Call describe_number or get_compiled_dialplan, or find_cdr_calls / get_recent_call_events for the number in the complaint. An empty or truncated list is not a cause.';
}

export function clipToolResult(toolName: string, content: string, maxChars: number): string {
  if (isCdrAnswerTool(toolName)) {
    // Report totals and coverage must stay parseable and cannot be silently
    // turned into a partial sample by cutting a row or a summary in half.
    try {
      const compact = JSON.stringify(JSON.parse(content));
      if (compact.length <= 12_000) return compact;
      return JSON.stringify({
        error: 'report_result_too_large',
        message: 'Narrow the period, filters or row limit. No partial report was returned.',
      });
    } catch {
      return JSON.stringify({
        error: 'report_result_invalid',
        message: 'The report tool failed or returned an unreadable result. Do not infer counts or contents.',
      });
    }
  }
  if (UNTRUNCATED_TOOLS.has(toolName)) return content;
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n[truncated]`;
}
