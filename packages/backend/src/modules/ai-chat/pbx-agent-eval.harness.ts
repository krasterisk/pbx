import * as fs from 'fs';
import * as path from 'path';
import { AgentSkillRegistryService } from '../ai-platform/agent-skill-registry.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { CallGroupsAiAdapter } from '../call-groups/call-groups-ai.adapter';
import { DirectoriesAiAdapter } from '../directories/directories-ai.adapter';
import { EndpointsAiAdapter } from '../endpoints/endpoints-ai.adapter';
import { IvrsAiAdapter } from '../ivrs/ivrs-ai.adapter';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { QueuesAiAdapter } from '../queues/queues-ai.adapter';
import { ReportsAiAdapter } from '../reports/reports-ai.adapter';
import { TrunksAiAdapter } from '../trunks/trunks-ai.adapter';
import { PbxAgentDiffService } from './pbx-agent-diff.service';
import { PbxAgentLoopService, type AgentStreamEvent } from './pbx-agent-loop.service';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { PlanAiAdapter } from './plan-ai.adapter';
import { PbxStateAiAdapter } from './pbx-state-ai.adapter';
import type { PbxWorkflowRunnerService, WorkflowPlanView } from './pbx-workflow-runner.service';
import type { AgentCompletion, AgentToolCall } from './pbx-agent.types';

export type EvalBucket =
  | 'read'
  | 'mutating'
  | 'cross-tenant'
  | 'diagnostic'
  | 'step-budget'
  | 'playbook'
  | 'failure'
  | 'adversarial';

export interface EvalModelTurn {
  text?: string;
  toolCalls?: Array<{
    id?: string;
    name: string;
    arguments?: Record<string, unknown>;
  }>;
}

export interface EvalScenario {
  id: string;
  bucket: EvalBucket;
  input: string;
  tenantUid: number;
  authorUid?: number;
  role?: number;
  locale?: string;
  maxSteps?: number;
  modelTurns: EvalModelTurn[];
  expectedToolSequence: string[];
  expectedProposal?: {
    entityType: string;
    entityLabel?: string;
    status?: string;
  };
  assertNoWrite?: boolean;
  peerTenantUid?: number;
  forgedTenantUid?: number;
  expectedTerminal?: { code: string };
}

export interface EvalAuditRow {
  user_uid: number;
  tool?: string;
  source: 'action_log' | 'cc_ai_audit_log';
}

export interface EvalProposalRow {
  entityType: string;
  entityLabel: string;
  status: string;
}

export interface EvalRunResult {
  events: AgentStreamEvent[];
  toolSequence: string[];
  auditRows: EvalAuditRow[];
  proposals: EvalProposalRow[];
  entityCountsBefore: Record<string, number>;
  entityCountsAfter: Record<string, number>;
  peerEntityCountsBefore?: Record<string, number>;
  peerEntityCountsAfter?: Record<string, number>;
  outboundRequests: number;
}

type TenantRow = { vpbx_user_uid: number };

interface EvalWorld {
  queues: Array<TenantRow & {
    name: string;
    display_name: string;
    strategy: string;
    timeout: number;
    members: unknown[];
    context: string | null;
  }>;
  directories: Array<TenantRow & {
    uid: number;
    name: string;
    description: string;
    lookup_field_uid: number;
    key_normalization: string;
    fields: unknown[];
    records: unknown[];
  }>;
  trunks: Array<TenantRow & { id: string; name: string; host: string }>;
  cdr: Array<TenantRow & { linkedid: string; src: string; dst: string; disposition: string }>;
  endpoints: TenantRow[];
  contexts: Array<TenantRow & { uid: number; name: string; comment: string }>;
  routes: TenantRow[];
}

const DEFAULT_SCENARIO_FILE = path.join(__dirname, 'evals', 'reference-scenarios.json');

export function loadReferenceScenarios(filePath = DEFAULT_SCENARIO_FILE): EvalScenario[] {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as EvalScenario[];
}

export function assertToolSequence(actual: string[], expected: string[]): void {
  const same = actual.length === expected.length && actual.every((name, index) => name === expected[index]);
  if (same) return;
  throw new Error(
    `Tool sequence mismatch\nactual: ${actual.join(', ') || '(empty)'}\nexpected: ${expected.join(', ') || '(empty)'}`,
  );
}

export function assertPendingProposal(
  proposals: EvalProposalRow[],
  expected: NonNullable<EvalScenario['expectedProposal']>,
): void {
  const match = proposals.find((row) => (
    row.entityType === expected.entityType
    && row.status === (expected.status ?? 'pending')
    && (expected.entityLabel == null || row.entityLabel === expected.entityLabel)
  ));
  if (!match) {
    throw new Error(
      `Pending proposal mismatch\nactual: ${JSON.stringify(proposals)}\nexpected: ${JSON.stringify(expected)}`,
    );
  }
}

export function assertNoWrite(
  before: Record<string, number>,
  after: Record<string, number>,
): void {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if ((before[key] ?? 0) !== (after[key] ?? 0)) {
      throw new Error(
        `Silent write detected for ${key}: before=${before[key] ?? 0} after=${after[key] ?? 0}`,
      );
    }
  }
}

export function assertAuditTenant(rows: EvalAuditRow[], tenantUid: number): void {
  const foreign = rows.filter((row) => row.user_uid !== tenantUid);
  if (foreign.length) {
    throw new Error(`Audit tenant mismatch: expected ${tenantUid}, saw ${JSON.stringify(foreign)}`);
  }
}

export function assertTerminalOutcome(events: AgentStreamEvent[], code: string): void {
  const last = events[events.length - 1];
  const actual = last && typeof last.data === 'object' && last.data
    ? String((last.data as { code?: string }).code ?? '')
    : '';
  if (last?.name !== 'error' || actual !== code) {
    throw new Error(`Terminal outcome mismatch\nactual: ${JSON.stringify(last)}\nexpected: ${code}`);
  }
}

class FixtureModelClient {
  outboundRequests = 0;
  private turns: AgentCompletion[] = [];
  private index = 0;

  setFixture(turns: EvalModelTurn[]): void {
    this.turns = turns.map((turn, step) => ({
      text: turn.text ?? '',
      toolCalls: (turn.toolCalls ?? []).map((call, callIndex): AgentToolCall => ({
        id: call.id ?? `eval_${step}_${callIndex}`,
        name: call.name,
        arguments: call.arguments ?? {},
      })),
    }));
    this.index = 0;
  }

  async chat(): Promise<AgentCompletion> {
    const next = this.turns[this.index] ?? this.turns[this.turns.length - 1] ?? { text: '', toolCalls: [] };
    this.index += 1;
    return next;
  }
}

export async function runScenario(scenario: EvalScenario): Promise<EvalRunResult> {
  const world = createWorld();
  const affectedTenant = scenario.forgedTenantUid ?? scenario.peerTenantUid;
  const primary = await replayOnce(scenario, world);
  let peerEntityCountsBefore: Record<string, number> | undefined;
  let peerEntityCountsAfter: Record<string, number> | undefined;

  if (affectedTenant != null) {
    peerEntityCountsBefore = primary.peerEntityCountsBefore;
    peerEntityCountsAfter = countEntities(world, affectedTenant);
  }

  if (scenario.peerTenantUid != null) {
    const peer = await replayOnce({ ...scenario, tenantUid: scenario.peerTenantUid }, world);
    assertToolSequence(peer.toolSequence, scenario.expectedToolSequence);
    assertAuditTenant(peer.auditRows, scenario.peerTenantUid);
    peerEntityCountsAfter = countEntities(world, scenario.peerTenantUid);
  }

  assertToolSequence(primary.toolSequence, scenario.expectedToolSequence);
  assertAuditTenant(primary.auditRows, scenario.tenantUid);
  if (scenario.expectedProposal) {
    assertPendingProposal(primary.proposals, scenario.expectedProposal);
  }
  if (scenario.assertNoWrite) {
    assertNoWrite(primary.entityCountsBefore, primary.entityCountsAfter);
  }
  if (scenario.forgedTenantUid != null && peerEntityCountsBefore && peerEntityCountsAfter) {
    assertNoWrite(peerEntityCountsBefore, peerEntityCountsAfter);
  }
  if (scenario.expectedTerminal) {
    assertTerminalOutcome(primary.events, scenario.expectedTerminal.code);
  }

  return {
    ...primary,
    peerEntityCountsBefore,
    peerEntityCountsAfter,
  };
}

async function replayOnce(scenario: EvalScenario, world: EvalWorld): Promise<EvalRunResult> {
  const llm = new FixtureModelClient();
  llm.setFixture(scenario.modelTurns);

  const auditRows: EvalAuditRow[] = [];
  const proposalRows: Array<{
    proposal_id: string;
    thread_uid: number;
    vpbx_user_uid: number;
    user_uid: number;
    entity_type: string;
    entity_label: string;
    summary: string[];
    before_json: Record<string, unknown> | null;
    after_json: Record<string, unknown> | null;
    apply_payload: Record<string, unknown>;
    includes_dialplan_reload: boolean;
    status: string;
    error: string | null;
    expires_at: Date;
    applied_at: Date | null;
    created_at: Date;
    update: (values: Record<string, unknown>) => Promise<unknown>;
  }> = [];

  const loggerService = {
    logAction: async (
      _userId: number,
      _action: string,
      _entityType: string,
      _entityId: unknown,
      vpbxUserUid: number,
      details?: string,
    ) => {
      auditRows.push({
        user_uid: vpbxUserUid,
        tool: String(details ?? ''),
        source: 'action_log',
      });
    },
  };

  const auditModel = {
    create: async (values: { user_uid?: number; vpbx_user_uid?: number; tool_name?: string }) => {
      auditRows.push({
        user_uid: values.user_uid ?? values.vpbx_user_uid ?? 0,
        tool: values.tool_name,
        source: 'cc_ai_audit_log',
      });
      return values;
    },
  };

  const proposalModel = {
    create: async (values: Record<string, unknown>) => {
      const row = {
        proposal_id: values.proposal_id as string,
        thread_uid: values.thread_uid as number,
        vpbx_user_uid: values.vpbx_user_uid as number,
        user_uid: values.user_uid as number,
        entity_type: values.entity_type as string,
        entity_label: values.entity_label as string,
        summary: values.summary as string[],
        before_json: (values.before_json as Record<string, unknown> | null) ?? null,
        after_json: (values.after_json as Record<string, unknown> | null) ?? null,
        apply_payload: values.apply_payload as Record<string, unknown>,
        includes_dialplan_reload: !!values.includes_dialplan_reload,
        status: (values.status as string) ?? 'pending',
        error: (values.error as string | null) ?? null,
        expires_at: values.expires_at as Date,
        applied_at: (values.applied_at as Date | null) ?? null,
        created_at: (values.created_at as Date) ?? new Date(),
        update: async (next: Record<string, unknown>) => {
          Object.assign(row, next);
          return row;
        },
      };
      proposalRows.push(row);
      return row;
    },
    findAll: async (opts: { where?: Record<string, unknown> } = {}) => (
      proposalRows.filter((row) => matchesWhere(row, opts.where))
    ),
    findOne: async (opts: { where?: Record<string, unknown> } = {}) => (
      proposalRows.find((row) => matchesWhere(row, opts.where)) ?? null
    ),
  };

  const queuesService = {
    findAll: async (uid: number) => world.queues.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (name: string, uid: number) => {
      const row = world.queues.find((item) => item.name === name && item.vpbx_user_uid === uid);
      if (!row) throw new Error(`queue not found: ${name}`);
      return row;
    },
    create: async (args: Record<string, unknown>, uid: number) => {
      const row = {
        name: String(args.name ?? args.exten ?? 'queue'),
        display_name: String(args.display_name ?? args.name ?? 'queue'),
        strategy: String(args.strategy ?? 'ringall'),
        timeout: Number(args.timeout ?? 30),
        members: Array.isArray(args.members) ? args.members : [],
        context: (args.context as string | null) ?? null,
        vpbx_user_uid: uid,
      };
      world.queues.push(row);
      return row;
    },
    update: async () => undefined,
    remove: async (name: string, uid: number) => {
      const index = world.queues.findIndex((row) => row.name === name && row.vpbx_user_uid === uid);
      if (index >= 0) world.queues.splice(index, 1);
    },
  };

  const directoriesService = {
    findAll: async (uid: number) => world.directories.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (directoryUid: number, uid: number) => {
      const row = world.directories.find((item) => item.uid === directoryUid && item.vpbx_user_uid === uid);
      if (!row) throw new Error(`directory not found: ${directoryUid}`);
      return row;
    },
    create: async (args: { name: string }, uid: number) => {
      const row = {
        uid: world.directories.length + 1,
        name: args.name,
        description: '',
        lookup_field_uid: 1,
        key_normalization: 'none',
        fields: [],
        records: [],
        vpbx_user_uid: uid,
      };
      world.directories.push(row);
      return row;
    },
  };

  const trunksService = {
    findAll: async (uid: number) => world.trunks.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (id: string, uid: number) => {
      const row = world.trunks.find((item) => item.id === id && item.vpbx_user_uid === uid);
      if (!row) throw new Error(`trunk not found: ${id}`);
      return row;
    },
    create: async (args: { name: string; host?: string }, uid: number) => {
      const row = {
        id: `t_${args.name}_${uid}`,
        name: args.name,
        host: args.host ?? '',
        vpbx_user_uid: uid,
      };
      world.trunks.push(row);
      return row;
    },
    remove: async (id: string, uid: number) => {
      const index = world.trunks.findIndex((row) => row.id === id && row.vpbx_user_uid === uid);
      if (index >= 0) world.trunks.splice(index, 1);
    },
  };

  const routesService = {
    findAll: async (uid: number) => world.routes.filter((row) => row.vpbx_user_uid === uid),
    findAllByContext: async (_contextUid: number, uid: number) => (
      world.routes.filter((row) => row.vpbx_user_uid === uid)
    ),
    create: async (args: Record<string, unknown>, uid: number) => {
      const row = { ...args, vpbx_user_uid: uid };
      world.routes.push(row);
      return row;
    },
  };

  const endpointsService = {
    findAll: async (uid: number) => world.endpoints.filter((row) => row.vpbx_user_uid === uid),
  };
  const contextsService = {
    findAll: async (uid: number) => world.contexts.filter((row) => row.vpbx_user_uid === uid),
  };
  const ivrsService = { findAll: async () => [], create: async () => undefined, update: async () => undefined, remove: async () => undefined };
  const callGroupsService = { findAll: async () => [], create: async () => undefined, update: async () => undefined, remove: async () => undefined };
  const cdrService = {
    getStats: async (uid: number) => ({
      totalCalls: world.cdr.filter((row) => row.vpbx_user_uid === uid).length,
      asr: 1,
    }),
    findCalls: async (uid: number, query: { search?: string; limit?: number } = {}) => {
      const rows = world.cdr.filter((row) => {
        if (row.vpbx_user_uid !== uid) return false;
        if (query.search) {
          return row.src.includes(query.search) || row.dst.includes(query.search);
        }
        return true;
      });
      return rows.slice(0, query.limit ?? 20);
    },
  };

  const registry = new AiAdapterRegistryService();
  const settings = { getSettings: async () => ({ confirmDestructive: false }) };
  const skillRegistry = { getCatalog: () => [] };
  const builder = new PbxContextBuilderService(
    endpointsService as never,
    trunksService as never,
    ivrsService as never,
    queuesService as never,
    contextsService as never,
    settings as never,
    registry,
    skillRegistry as never,
  );

  const routeReferencesService = { findUsage: async () => ({ references: [] }) };
  new AgentSkillRegistryService(registry).onModuleInit();
  new EndpointsAiAdapter(endpointsService as never, registry).onModuleInit();
  new DirectoriesAiAdapter(directoriesService as never, registry).onModuleInit();
  new QueuesAiAdapter(
    queuesService as never,
    registry,
    contextsService as never,
    endpointsService as never,
    routeReferencesService as never,
  ).onModuleInit();
  new ReportsAiAdapter(cdrService as never, registry).onModuleInit();
  new PbxStateAiAdapter(builder, registry).onModuleInit();
  new TrunksAiAdapter(trunksService as never, routesService as never, registry).onModuleInit();
  new CallGroupsAiAdapter(
    callGroupsService as never,
    registry,
    endpointsService as never,
    routeReferencesService as never,
  ).onModuleInit();
  new IvrsAiAdapter(
    ivrsService as never,
    registry,
    contextsService as never,
    endpointsService as never,
    queuesService as never,
    callGroupsService as never,
  ).onModuleInit();
  const workflows = {
    createFromDraft: async (draft: { title?: string; steps: unknown[] }): Promise<WorkflowPlanView> => ({
      workflowId: 'wf_eval',
      threadUid: 0,
      title: draft.title ?? '',
      summary: [],
      status: 'pending',
      error: null,
      expiresAt: new Date().toISOString(),
      appliedAt: null,
      steps: (draft.steps ?? []) as WorkflowPlanView['steps'],
    }),
  };
  new PlanAiAdapter(registry, workflows as unknown as PbxWorkflowRunnerService).onModuleInit();

  const diff = new PbxAgentDiffService(
    proposalModel as never,
    { applyContext: async () => ({ success: true }) } as never,
    loggerService as never,
    auditModel as never,
    registry,
  );

  const mcp = new McpToolsService(
    registry,
    loggerService as never,
    diff,
  );
  mcp.onApplicationBootstrap();

  const stored: Array<{ role: string; content?: string | null; tool_name?: string | null; tool_calls?: unknown }> = [];
  const threads = {
    listMessages: async () => stored.map((row, index) => ({ uid: index + 1, ...row })),
    listMessagesForReplay: async () => stored.map((row, index) => ({ uid: index + 1, ...row })),
    getThread: async () => ({ uid: 900 + scenario.tenantUid, brief_json: null, brief_version: 0 }),
    saveBrief: async () => undefined,
    setProviderUid: async () => undefined,
    appendMessage: async (
      _threadUid: number,
      _tenant: number,
      _author: number,
      input: (typeof stored)[number],
    ) => {
      stored.push(input);
      return { uid: stored.length, created_at: new Date('2026-09-08T05:00:00.000Z'), ...input };
    },
    findByPk: async () => {
      throw new Error('findByPk is forbidden for tenant-owned rows');
    },
    addUsage: async () => undefined,
  };

  const providers = {
    findDefaultLlm: async () => ({
      uid: 1,
      name: 'eval-fixture',
      endpoint: 'http://127.0.0.1/eval-unused',
      auth_type: 'none' as const,
      encrypted_api_key: '',
      capabilities: ['llm', 'tools'],
      defaults: { model: 'eval-fixture' },
      vendor: 'fixture',
    }),
  };

  const config = {
    get: (key: string, fallback?: unknown) => {
      if (key === 'CC_AI_MAX_AGENT_STEPS') return scenario.maxSteps ?? fallback ?? 12;
      if (key === 'CC_AI_TOOL_ARG_RETRIES') return fallback ?? 1;
      return fallback;
    },
  };

  const briefService = {
    compile: (_brief: unknown, messageUid: number, text: string) => ({
      anchor: text,
      anchorMessageUid: messageUid,
      goal: 'general',
      facts: [],
      replacements: [],
      missingFacts: [],
      workflowProgress: { status: 'idle' as const },
      version: 1,
      updatedThroughMessageUid: messageUid,
    }),
  };

  const loop = new PbxAgentLoopService(
    llm as never,
    providers as never,
    builder,
    threads as never,
    mcp,
    config as never,
    { getDefaultProviderUid: async () => null } as never,
    briefService as never,
    {
      classify: () => ({
        intents: ['general'],
        skillNames: [],
        domains: [],
        confidence: 0.2,
        source: 'fallback' as const,
      }),
      filterToolNames: (names: string[]) => names,
    } as never,
    { readSkillsForPrompt: () => [] } as never,
    {
      findLatestPendingForThread: async () => null,
      apply: async () => {
        throw new Error('unexpected apply');
      },
    } as never,
  );

  const entityCountsBefore = countEntities(world, scenario.tenantUid);
  const peerUid = scenario.forgedTenantUid ?? scenario.peerTenantUid;
  const peerEntityCountsBefore = peerUid != null ? countEntities(world, peerUid) : undefined;

  const events: AgentStreamEvent[] = [];
  for await (const event of loop.runTurn(
    scenario.input,
    { uid: 900 + scenario.tenantUid },
    {
      tenantUid: scenario.tenantUid,
      authorUid: scenario.authorUid ?? 11,
      role: scenario.role ?? 1,
      locale: scenario.locale ?? 'ru',
    },
  )) {
    events.push(event);
  }

  return {
    events,
    toolSequence: events
      .filter((event) => (
        event.name === 'item'
        && (event.data as { kind?: string }).kind === 'step'
        && (event.data as { done?: boolean }).done === false
      ))
      .map((event) => String((event.data as { labelFallback?: string }).labelFallback ?? '')),
    auditRows,
    proposals: proposalRows.map((row) => ({
      entityType: row.entity_type,
      entityLabel: row.entity_label,
      status: row.status,
    })),
    entityCountsBefore,
    entityCountsAfter: countEntities(world, scenario.tenantUid),
    peerEntityCountsBefore,
    peerEntityCountsAfter: peerUid != null ? countEntities(world, peerUid) : undefined,
    outboundRequests: llm.outboundRequests,
  };
}

function createWorld(): EvalWorld {
  return {
    queues: [
      queue(100, 'sales', 'Sales'),
      queue(100, 'support', 'Support'),
      queue(200, 'billing', 'Billing'),
    ],
    directories: [
      directory(100, 1, 'VIP'),
      directory(200, 2, 'Other'),
    ],
    trunks: [
      { id: 't_mtt_100', name: 'MTT', host: 'sip.mtt.example', vpbx_user_uid: 100 },
      { id: 't_other_200', name: 'Other', host: 'sip.other.example', vpbx_user_uid: 200 },
    ],
    cdr: [
      { linkedid: 'a1', src: '74951234567', dst: '100', disposition: 'ANSWERED', vpbx_user_uid: 100 },
      { linkedid: 'b1', src: '74957654321', dst: '200', disposition: 'NO ANSWER', vpbx_user_uid: 200 },
    ],
    endpoints: [],
    contexts: [
      { uid: 10, name: 'from-internal', comment: '', vpbx_user_uid: 100 },
      { uid: 20, name: 'from-internal', comment: '', vpbx_user_uid: 200 },
    ],
    routes: [],
  };
}

function queue(tenant: number, name: string, displayName: string) {
  return {
    name,
    display_name: displayName,
    strategy: 'ringall',
    timeout: 30,
    members: [],
    context: null,
    vpbx_user_uid: tenant,
  };
}

function directory(tenant: number, uid: number, name: string) {
  return {
    uid,
    name,
    description: '',
    lookup_field_uid: 1,
    key_normalization: 'digits',
    fields: [],
    records: [],
    vpbx_user_uid: tenant,
  };
}

function countEntities(world: EvalWorld, tenantUid: number): Record<string, number> {
  return {
    queues: world.queues.filter((row) => row.vpbx_user_uid === tenantUid).length,
    directories: world.directories.filter((row) => row.vpbx_user_uid === tenantUid).length,
    trunks: world.trunks.filter((row) => row.vpbx_user_uid === tenantUid).length,
    cdr: world.cdr.filter((row) => row.vpbx_user_uid === tenantUid).length,
    routes: world.routes.filter((row) => row.vpbx_user_uid === tenantUid).length,
    endpoints: world.endpoints.filter((row) => row.vpbx_user_uid === tenantUid).length,
  };
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => row[key] === value);
}
