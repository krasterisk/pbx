import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import type { AiToolDefinition } from './ai-adapter.types';
import {
  assertNoTenantAliases,
  defineMutationTool,
  jsonSchemaOf,
} from './ai-mutation.contract';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { PbxAgentDiffService } from '../ai-chat/pbx-agent-diff.service';
import { DirectoriesAiAdapter } from '../directories/directories-ai.adapter';
import { EndpointsAiAdapter } from '../endpoints/endpoints-ai.adapter';
import { TrunksAiAdapter } from '../trunks/trunks-ai.adapter';
import { IvrsAiAdapter } from '../ivrs/ivrs-ai.adapter';
import { QueuesAiAdapter } from '../queues/queues-ai.adapter';
import { CallGroupsAiAdapter } from '../call-groups/call-groups-ai.adapter';
import { RoutesAiAdapter } from '../routes/routes-ai.adapter';
import { MohAiAdapter } from '../moh/moh-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;
const AUTHOR_A = 11;

/**
 * Model-facing arguments for every migrated mutation. The completeness test
 * fails when a proposing tool has no entry here, so a new mutation cannot be
 * added without a propose/apply exercise.
 */
const MUTATION_FIXTURES: Record<string, Record<string, unknown>> = {
  create_directory: {
    name: 'Новый справочник',
    lookupFieldKey: 'num',
    key_normalization: 'digits',
    fields: [{ key: 'num', label: 'Номер', type: 'string' }],
  },
  update_directory: { uid: 10, name: 'VIP-2' },
  delete_directory: { uid: 10 },
  add_directory_records: {
    uid: 10,
    records: [{ match_kind: 'exact', priority: 0, values: { num: '777' } }],
  },
  remove_directory_records: { uid: 10, lookup_values: ['123'] },
  create_endpoint: { extension: '210', name: 'Боб', context: 'from-internal' },
  create_endpoints_bulk: { extensionsPattern: '220-221', context: 'from-internal' },
  delete_endpoint: { sipId: '201' },
  create_trunk: { name: 'МТТ-2', trunkType: 'ip', host: 'sip.mtt.ru' },
  delete_trunk: { trunkId: 't_mtt_100' },
  create_ivr: {
    name: 'Новое меню',
    text: 'Здравствуйте',
    menu_items: [{ digit: '1', destination: { kind: 'extension', target: '201' } }],
  },
  update_ivr: { id: 9, digit: '2', destination: { kind: 'extension', target: '201' } },
  delete_ivr: { id: 9 },
  create_queue: {
    name: 'Support-2',
    exten: '300',
    strategy: 'ringall',
    overflow: 'from-internal',
    members: [{ interface: 'PJSIP/e201_100' }],
  },
  update_queue: { name: 'Support', timeout: 60 },
  delete_queue: { name: 'Support' },
  create_route: {
    context_uid: 7,
    pattern: '_3XX',
    name: 'Новый маршрут',
    actions: [{ type: 'toexten', params: { target: { source: 'fixed', value: '201' } } }],
  },
  delete_route: { id: 11 },
  create_call_group: {
    name: 'Группа 2',
    exten: '702',
    strategy: 'ringall',
    members: [{ member_type: 'internal', value: '201' }],
  },
  update_call_group_members: { uid: 5, members: [{ member_type: 'internal', value: '201' }] },
  delete_call_group: { uid: 5 },
  assign_moh_class: { target_type: 'queue', target: 'q200_100', class_name: 'moh_100_jazz' },
};

/** Domain-service methods that write. Used to prove propose writes nothing and apply writes once. */
const WRITE_METHODS = ['create', 'update', 'remove', 'bulkCreate', 'createWithGeneratedCredentials'] as const;

interface ProposalRow {
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
  update: (values: Partial<ProposalRow>) => Promise<ProposalRow>;
}

function matchesWhere(row: ProposalRow, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

function tenantFixtures() {
  const contexts = [{ uid: 7, name: 'from-internal', comment: 'internal' }];
  const endpoints = [
    {
      extension: '201',
      sipUsername: 'e201_100',
      context: 'from-internal',
      endpoint: { callerid: '"Алиса" <201>' },
    },
  ];
  const queues = [
    {
      name: 'q200_100',
      display_name: 'Support',
      exten: '200',
      strategy: 'ringall',
      timeout: 30,
      context: 'from-internal',
      musiconhold: 'moh_100_old',
      members: [{ interface: 'PJSIP/e201_100', membername: 'Алиса', penalty: 0 }],
    },
  ];
  const groups = [
    {
      uid: 5,
      name: 'Продажи',
      exten: '701',
      strategy: 'ringall',
      members: [{ member_type: 'internal', value: '201', position: 1 }],
    },
  ];
  const ivrs = [
    {
      uid: 9,
      name: 'Главное меню',
      timeout: 5,
      menu_items: [
        {
          digit: '1',
          actions: [{ type: 'toexten', params: { target: { source: 'fixed', value: '201' } } }],
        },
      ],
    },
  ];
  const routes = [
    {
      uid: 11,
      name: 'Входящий',
      context_uid: 7,
      priority: 1,
      extensions: ['_2XX'],
      actions: [{ type: 'toexten', params: { target: { source: 'fixed', value: '201' } } }],
      options: {},
    },
  ];
  const directories = [
    {
      uid: 10,
      name: 'VIP',
      description: 'VIP book',
      lookup_field_uid: 1,
      key_normalization: 'digits',
      fields: [{ uid: 1, key: 'num', label: 'Номер', type: 'string' }],
      records: [
        { uid: 1, lookup_value: '123', match_kind: 'exact', priority: 0, values: { num: '123' } },
      ],
    },
  ];
  const trunks = [{ id: 't_mtt_100', name: 'МТТ', host: 'sip.mtt.ru', trunkType: 'auth' }];
  const mohClasses = [
    {
      name: 'moh_100_jazz',
      displayName: 'Jazz',
      mode: 'files',
      sort: 'alpha',
      entries: [{ position: 1, entry: '/usr/moh/a.wav' }],
    },
  ];
  return { contexts, endpoints, queues, groups, ivrs, routes, directories, trunks, mohClasses };
}

type Harness = ReturnType<typeof bootHarness>;

function bootHarness() {
  const data = tenantFixtures();
  const forTenant = <T>(rows: T[], uid: number): T[] => (uid === TENANT_A ? rows : []);

  const directoriesService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.directories, uid)),
    findOne: jest.fn(async (uid: number, tenant: number) => {
      const found = forTenant(data.directories, tenant).find((row) => row.uid === uid);
      if (!found) throw new Error('Directory not found');
      return found;
    }),
    create: jest.fn(async () => ({ uid: 99 })),
    update: jest.fn(async () => ({ uid: 10 })),
    remove: jest.fn(async () => undefined),
  };
  const endpointsService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.endpoints, uid)),
    findOne: jest.fn(async (sipId: string, tenant: number) => {
      const found = forTenant(data.endpoints, tenant).find((row) => row.sipUsername === sipId);
      if (!found) throw new Error('Endpoint not found');
      return found;
    }),
    createWithGeneratedCredentials: jest.fn(async () => ({ id: 'e210_100' })),
    bulkCreate: jest.fn(async () => ({ created: 2 })),
    remove: jest.fn(async () => undefined),
  };
  const trunksService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.trunks, uid)),
    findOne: jest.fn(async (trunkId: string, tenant: number) => {
      const found = forTenant(data.trunks, tenant).find((row) => row.id === trunkId);
      if (!found) throw new Error('Trunk not found');
      return found;
    }),
    create: jest.fn(async () => ({ id: 't_new_100' })),
    remove: jest.fn(async () => undefined),
  };
  const ivrsService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.ivrs, uid)),
    findOne: jest.fn(async (uid: number, tenant: number) => {
      const found = forTenant(data.ivrs, tenant).find((row) => row.uid === uid);
      if (!found) throw new Error('IVR not found');
      return found;
    }),
    create: jest.fn(async () => ({ uid: 90 })),
    update: jest.fn(async () => ({ uid: 9 })),
    remove: jest.fn(async () => undefined),
  };
  const queuesService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.queues, uid)),
    findOne: jest.fn(async (name: string, tenant: number) => {
      const rows = forTenant(data.queues, tenant);
      const found = rows.find((row) => row.name === name || row.display_name === name || row.exten === name);
      if (!found) throw new Error(`Queue "${name}" not found`);
      return found;
    }),
    create: jest.fn(async () => ({ name: 'q300_100' })),
    update: jest.fn(async () => ({ name: 'q200_100' })),
    remove: jest.fn(async () => undefined),
  };
  const callGroupsService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.groups, uid)),
    findOne: jest.fn(async (uid: number, tenant: number) => {
      const found = forTenant(data.groups, tenant).find((row) => row.uid === uid);
      if (!found) throw new Error('Call group not found');
      return found;
    }),
    create: jest.fn(async () => ({ uid: 50 })),
    update: jest.fn(async () => ({ uid: 5 })),
    remove: jest.fn(async () => undefined),
  };
  const routesService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.routes, uid)),
    findAllByContext: jest.fn(async (contextUid: number, tenant: number) =>
      forTenant(data.routes, tenant).filter((row) => row.context_uid === contextUid),
    ),
    findOne: jest.fn(async (uid: number, tenant: number) => {
      const found = forTenant(data.routes, tenant).find((row) => row.uid === uid);
      if (!found) throw new Error('Route not found');
      return found;
    }),
    create: jest.fn(async () => ({ uid: 12 })),
    update: jest.fn(async () => ({ uid: 11 })),
    remove: jest.fn(async () => undefined),
  };
  const contextsService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.contexts, uid)),
  };
  const mohService = {
    findAll: jest.fn(async (uid: number) => forTenant(data.mohClasses, uid)),
    findOne: jest.fn(async (name: string, tenant: number) => {
      const found = forTenant(data.mohClasses, tenant).find((row) => row.name === name);
      if (!found) throw new Error('MOH class not found');
      return found;
    }),
    update: jest.fn(async () => ({ name: 'moh_100_jazz' })),
  };
  const routeReferencesService = {
    findUsage: jest.fn(async () => ({ references: [] })),
  };

  const registry = new AiAdapterRegistryService();
  new DirectoriesAiAdapter(directoriesService as any, registry).onModuleInit();
  new EndpointsAiAdapter(endpointsService as any, registry).onModuleInit();
  new TrunksAiAdapter(trunksService as any, routesService as any, registry).onModuleInit();
  new IvrsAiAdapter(
    ivrsService as any,
    registry,
    contextsService as any,
    endpointsService as any,
    queuesService as any,
    callGroupsService as any,
  ).onModuleInit();
  new QueuesAiAdapter(
    queuesService as any,
    registry,
    contextsService as any,
    endpointsService as any,
    routeReferencesService as any,
  ).onModuleInit();
  new CallGroupsAiAdapter(
    callGroupsService as any,
    registry,
    endpointsService as any,
    routeReferencesService as any,
  ).onModuleInit();
  new RoutesAiAdapter(
    routesService as any,
    contextsService as any,
    queuesService as any,
    endpointsService as any,
    trunksService as any,
    ivrsService as any,
    directoriesService as any,
    callGroupsService as any,
    registry,
  ).onModuleInit();
  new MohAiAdapter(
    mohService as any,
    registry,
    queuesService as any,
    routesService as any,
  ).onModuleInit();

  const rows: ProposalRow[] = [];
  const proposalModel = {
    create: jest.fn(async (values: Partial<ProposalRow>) => {
      const row = {
        ...values,
        before_json: values.before_json ?? null,
        after_json: values.after_json ?? null,
        includes_dialplan_reload: !!values.includes_dialplan_reload,
        status: values.status ?? 'pending',
        error: values.error ?? null,
        applied_at: values.applied_at ?? null,
        created_at: values.created_at ?? new Date(),
        update: async (next: Partial<ProposalRow>) => {
          Object.assign(row, next);
          return row;
        },
      } as ProposalRow;
      rows.push(row);
      return row;
    }),
    findOne: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) =>
      rows.find((row) => matchesWhere(row, opts.where)) ?? null,
    ),
    findAll: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) =>
      rows.filter((row) => matchesWhere(row, opts.where)),
    ),
    update: jest.fn(async (values: Partial<ProposalRow>, opts: { where?: Record<string, unknown> } = {}) => {
      const matched = rows.filter((row) => matchesWhere(row, opts.where));
      matched.forEach((row) => Object.assign(row, values));
      return [matched.length];
    }),
  };
  const routeApplyService = {
    applyContext: jest.fn().mockResolvedValue({ success: true, filename: 'x', linesApplied: 1 }),
  };
  const loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
  const auditModel = { create: jest.fn().mockResolvedValue({ uid: 1 }) };

  const diff = new PbxAgentDiffService(
    proposalModel as any,
    routeApplyService as any,
    loggerService as any,
    auditModel as any,
    registry,
  );

  const mcp = new McpToolsService(registry, loggerService as any, diff);
  mcp.registerAll();

  const services = {
    directoriesService,
    endpointsService,
    trunksService,
    ivrsService,
    queuesService,
    callGroupsService,
    routesService,
    contextsService,
    mohService,
    routeReferencesService,
  };

  return { registry, mcp, diff, rows, proposalModel, routeApplyService, auditModel, loggerService, services, data };
}

function writeCallCount(harness: Harness): number {
  let total = 0;
  for (const service of Object.values(harness.services)) {
    for (const method of WRITE_METHODS) {
      const mock = (service as Record<string, unknown>)[method] as jest.Mock | undefined;
      if (mock && typeof mock.mock === 'object') total += mock.mock.calls.length;
    }
  }
  return total;
}

function mutationTools(harness: Harness): AiToolDefinition[] {
  return harness.registry.getAllTools().filter((tool) => tool.proposes);
}

const ctxA = { vpbxUserUid: TENANT_A, userUid: AUTHOR_A, role: UserLevel.ADMIN, threadUid: 3 };

function textOf(parts: Array<{ text: string }>): string {
  return parts[0]?.text ?? '';
}

async function proposeVia(
  harness: Harness,
  name: string,
  args: Record<string, unknown>,
  uid = TENANT_A,
): Promise<Record<string, any>> {
  const result = await harness.mcp.callTool(name, args, uid, ctxA);
  return JSON.parse(textOf(result));
}

describe('executable mutation contract — booted adapters', () => {
  let harness: Harness;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    harness = bootHarness();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    void warnSpy;
  });

  it('gives every proposing tool a schema, propose, revalidate, apply and an adapter-owned reload policy', () => {
    const tools = mutationTools(harness);
    expect(tools.length).toBeGreaterThanOrEqual(22);

    const gaps: string[] = [];
    for (const tool of tools) {
      const mutation = tool.mutation;
      if (!mutation) {
        gaps.push(`${tool.name}: no executable mutation contract`);
        continue;
      }
      if (typeof mutation.schemaVersion !== 'string' || !mutation.schemaVersion) {
        gaps.push(`${tool.name}: no schemaVersion`);
      }
      if (typeof mutation.propose !== 'function') gaps.push(`${tool.name}: no propose`);
      if (typeof mutation.revalidate !== 'function') gaps.push(`${tool.name}: no revalidate`);
      if (typeof mutation.apply !== 'function') gaps.push(`${tool.name}: no apply`);
      if (!mutation.reload || typeof mutation.reload.kind !== 'string') {
        gaps.push(`${tool.name}: no reload policy`);
      }
      if (!(mutation.input instanceof z.ZodType)) gaps.push(`${tool.name}: input is not a zod schema`);
      if (!(mutation.args instanceof z.ZodType)) gaps.push(`${tool.name}: args is not a zod schema`);
      if (!MUTATION_FIXTURES[tool.name]) gaps.push(`${tool.name}: no propose/apply fixture in this spec`);
    }
    expect(gaps).toEqual([]);
  });

  it('derives every model-facing JSON schema from the executable schema and closes it to extra properties', () => {
    const listed = harness.mcp.getToolsList(TENANT_A);
    const failures: string[] = [];
    for (const tool of mutationTools(harness)) {
      const entry = listed.find((row) => row.name === tool.name);
      if (!entry) {
        failures.push(`${tool.name}: absent from the MCP tool list`);
        continue;
      }
      const derived = jsonSchemaOf(tool.mutation!.input);
      if (JSON.stringify(entry.inputSchema) !== JSON.stringify(derived)) {
        failures.push(`${tool.name}: MCP schema is not the executable schema`);
      }
      if (derived.additionalProperties !== false) {
        failures.push(`${tool.name}: schema accepts extra properties`);
      }
      for (const key of Object.keys(derived.properties ?? {})) {
        if (/vpbx|tenant|user_?uid/i.test(key)) failures.push(`${tool.name}: exposes tenant key "${key}"`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('resolves every stored apply tool from the registry and keeps no handwritten apply switch', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../ai-chat/pbx-agent-diff.service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/executePayload/);
    expect(source).not.toMatch(/Unsupported apply tool/);
    expect(source).not.toMatch(/case '(create|update|delete|add|remove|assign)_/);

    for (const tool of mutationTools(harness)) {
      expect(harness.registry.getMutationTool(tool.name)).toBeDefined();
    }
    expect(harness.registry.getMutationTool('update_route')).toBeUndefined();
  });

  it('fails fast on a duplicate domain and on a duplicate tool name', () => {
    const registry = new AiAdapterRegistryService();
    const stub = (name: string): AiToolDefinition => ({
      name,
      description: name,
      inputSchema: {},
      entityType: 'test',
      handler: async () => 'ok',
    });
    registry.register({ domain: 'alpha', getTools: () => [stub('tool_one')] });
    expect(() => registry.register({ domain: 'alpha', getTools: () => [stub('tool_two')] })).toThrow(
      /alpha/,
    );
    expect(() => registry.register({ domain: 'beta', getTools: () => [stub('tool_one')] })).toThrow(
      /tool_one/,
    );
  });
});

describe('runtime dispatch validation', () => {
  let harness: Harness;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    harness = bootHarness();
  });

  afterEach(() => jest.restoreAllMocks());

  it('refuses an unknown property instead of silently dropping it', async () => {
    const result = await harness.mcp.callTool(
      'create_call_group',
      { ...MUTATION_FIXTURES.create_call_group, ringDurationn: 12 },
      TENANT_A,
      ctxA,
    );
    expect(textOf(result)).toMatch(/ringDurationn/);
    expect(harness.rows).toHaveLength(0);
    expect(harness.services.callGroupsService.create).not.toHaveBeenCalled();
  });

  it('refuses a missing required property', async () => {
    const result = await harness.mcp.callTool('delete_call_group', {}, TENANT_A, ctxA);
    expect(textOf(result)).toMatch(/uid/);
    expect(harness.rows).toHaveLength(0);
  });

  it('rejects a tenant alias nested inside an argument object', async () => {
    const result = await harness.mcp.callTool(
      'create_ivr',
      {
        name: 'Меню',
        menu_items: [
          {
            digit: '1',
            actions: [
              { type: 'toexten', params: { target: { source: 'fixed', value: '201' }, vpbx_user_uid: TENANT_B } },
            ],
          },
        ],
      },
      TENANT_A,
      ctxA,
    );
    expect(textOf(result)).toMatch(/vpbx_user_uid/);
    expect(harness.rows).toHaveLength(0);
    expect(harness.services.ivrsService.create).not.toHaveBeenCalled();
  });

  it('rejects tenant aliases at any depth outside of tool dispatch too', () => {
    expect(() => assertNoTenantAliases({ a: [{ b: { tenantId: 3 } }] })).toThrow(/tenantId/);
    expect(() => assertNoTenantAliases({ a: [{ b: { ok: 3 } }] })).not.toThrow();
  });
});

describe('propose writes nothing', () => {
  let harness: Harness;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    harness = bootHarness();
  });

  afterEach(() => jest.restoreAllMocks());

  it('proposes every migrated mutation without a single domain write', async () => {
    for (const tool of mutationTools(harness)) {
      const view = await proposeVia(harness, tool.name, MUTATION_FIXTURES[tool.name]);
      expect(view.proposalId).toEqual(expect.any(String));
      expect(view.status).toBe('pending');
      expect(JSON.stringify(view)).not.toMatch(/applyPayload|apply_payload/);
    }
    expect(writeCallCount(harness)).toBe(0);
  });

  it('stores canonical args and the adapter schema version, never the model reload flag', async () => {
    await proposeVia(harness, 'create_route', {
      ...MUTATION_FIXTURES.create_route,
      // includesDialplanReload is adapter-owned; nothing the model sends can set it
    });
    const row = harness.rows[0];
    const payload = row.apply_payload as { tool: string; args: Record<string, unknown>; schemaVersion?: string };
    expect(payload.tool).toBe('create_route');
    expect(payload.schemaVersion).toBe(harness.registry.getMutationTool('create_route')!.mutation!.schemaVersion);
    expect(payload.args).toMatchObject({ context_uid: 7, extensions: ['_3XX'] });
    expect(row.includes_dialplan_reload).toBe(true);

    await proposeVia(harness, 'create_call_group', MUTATION_FIXTURES.create_call_group);
    expect(harness.rows[1].includes_dialplan_reload).toBe(false);
  });
});

describe('apply through the adapter contract', () => {
  let harness: Harness;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    harness = bootHarness();
  });

  afterEach(() => jest.restoreAllMocks());

  it('runs the adapter apply exactly once for every migrated mutation', async () => {
    const failures: string[] = [];
    for (const tool of mutationTools(harness)) {
      const fresh = bootHarness();
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const view = await proposeVia(fresh, tool.name, MUTATION_FIXTURES[tool.name]);
      const before = writeCallCount(fresh);
      const result = await fresh.diff.apply(view.proposalId, ctxA);
      const after = writeCallCount(fresh);
      if (!result.ok) failures.push(`${tool.name}: apply refused (${result.reason ?? result.error})`);
      if (after - before !== 1) failures.push(`${tool.name}: ${after - before} domain writes, expected 1`);
      if (fresh.rows[0].status !== 'applied') failures.push(`${tool.name}: row status ${fresh.rows[0].status}`);
    }
    expect(failures).toEqual([]);
  });

  it('closes the assign_moh_class gap by writing the class onto the queue', async () => {
    const view = await proposeVia(harness, 'assign_moh_class', MUTATION_FIXTURES.assign_moh_class);
    const result = await harness.diff.apply(view.proposalId, ctxA);

    expect(result.ok).toBe(true);
    expect(harness.services.queuesService.update).toHaveBeenCalledWith(
      'q200_100',
      expect.objectContaining({ musiconhold: 'moh_100_jazz' }),
      TENANT_A,
    );
  });

  it('reloads the dialplan only where the adapter asks for it', async () => {
    const route = await proposeVia(harness, 'create_route', MUTATION_FIXTURES.create_route);
    await harness.diff.apply(route.proposalId, ctxA);
    expect(harness.routeApplyService.applyContext).toHaveBeenCalledTimes(1);
    expect(harness.routeApplyService.applyContext).toHaveBeenCalledWith(7, TENANT_A, true);

    harness.routeApplyService.applyContext.mockClear();
    const group = await proposeVia(harness, 'create_call_group', MUTATION_FIXTURES.create_call_group);
    await harness.diff.apply(group.proposalId, ctxA);
    expect(harness.routeApplyService.applyContext).not.toHaveBeenCalled();
  });

  it('refuses a stored payload whose schema version no longer matches the adapter', async () => {
    const view = await proposeVia(harness, 'create_call_group', MUTATION_FIXTURES.create_call_group);
    const payload = harness.rows[0].apply_payload as Record<string, unknown>;
    harness.rows[0].apply_payload = { ...payload, schemaVersion: 'stale-1' };

    const result = await harness.diff.apply(view.proposalId, ctxA);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/stale|schema/i);
    expect(harness.services.callGroupsService.create).not.toHaveBeenCalled();
    expect(harness.rows[0].status).not.toBe('applied');
  });

  it('applies once when the same proposal is confirmed twice concurrently', async () => {
    const view = await proposeVia(harness, 'create_call_group', MUTATION_FIXTURES.create_call_group);
    const [first, second] = await Promise.all([
      harness.diff.apply(view.proposalId, ctxA),
      harness.diff.apply(view.proposalId, ctxA),
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect(harness.services.callGroupsService.create).toHaveBeenCalledTimes(1);
    expect(harness.rows[0].status).toBe('applied');
  });

  it('re-checks fresh tenant state and refuses when the destination disappeared', async () => {
    const view = await proposeVia(harness, 'create_call_group', MUTATION_FIXTURES.create_call_group);
    harness.services.endpointsService.findAll.mockResolvedValue([]);

    const result = await harness.diff.apply(view.proposalId, ctxA);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/201|не найден|revalidate/i);
    expect(harness.services.callGroupsService.create).not.toHaveBeenCalled();
    expect(harness.rows[0].status).toBe('pending');
  });

  it('re-runs canonical route validation on apply and refuses a shadowing pattern', async () => {
    const view = await proposeVia(harness, 'create_route', {
      ...MUTATION_FIXTURES.create_route,
      pattern: '_3XX',
    });
    harness.services.routesService.findAllByContext.mockResolvedValue([
      { uid: 11, context_uid: 7, priority: 1, extensions: ['_X.'], actions: [] },
    ]);

    const result = await harness.diff.apply(view.proposalId, ctxA);

    expect(result.ok).toBe(false);
    expect(harness.services.routesService.create).not.toHaveBeenCalled();
    expect(harness.routeApplyService.applyContext).not.toHaveBeenCalled();
  });

  it('keeps the JWT tenant on apply and never a tenant key smuggled into the stored payload', async () => {
    const view = await proposeVia(harness, 'create_call_group', MUTATION_FIXTURES.create_call_group);
    const payload = harness.rows[0].apply_payload as { tool: string; args: Record<string, unknown>; schemaVersion: string };
    harness.rows[0].apply_payload = {
      ...payload,
      args: { ...payload.args, vpbxUserUid: TENANT_B, user_uid: 0 },
    };

    const result = await harness.diff.apply(view.proposalId, ctxA);

    expect(result.ok).toBe(true);
    expect(harness.services.callGroupsService.create).toHaveBeenCalledTimes(1);
    const [dto, tenant] = harness.services.callGroupsService.create.mock.calls[0];
    expect(tenant).toBe(TENANT_A);
    expect(dto.vpbxUserUid).toBeUndefined();
    expect(dto.user_uid).toBeUndefined();
  });

  it('refuses a foreign-tenant confirmation and a read-only role', async () => {
    const view = await proposeVia(harness, 'create_call_group', MUTATION_FIXTURES.create_call_group);

    const foreign = await harness.diff.apply(view.proposalId, { ...ctxA, vpbxUserUid: TENANT_B });
    expect(foreign.ok).toBe(false);
    expect(harness.services.callGroupsService.create).not.toHaveBeenCalled();

    const readonly = await harness.diff.apply(view.proposalId, { ...ctxA, role: UserLevel.READONLY });
    expect(readonly.ok).toBe(false);
    expect(readonly.reason).toBe('denied');
    expect(harness.services.callGroupsService.create).not.toHaveBeenCalled();
    expect(harness.auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'denied' }),
    );
  });
});

describe('defineMutationTool guard rails', () => {
  it('refuses a non-strict input schema at definition time', () => {
    const spec = {
      name: 'loose_tool',
      description: 'loose',
      entityType: 'test',
      schemaVersion: '1',
      input: z.object({ a: z.string() }) as any,
      args: z.strictObject({ a: z.string() }),
      reload: { kind: 'none' as const },
      propose: async () => ({
        entityType: 'test',
        entityLabel: 'x',
        summary: [],
        before: null,
        after: null,
        applyPayload: { tool: 'loose_tool', args: {} },
        includesDialplanReload: false,
      }),
      revalidate: async (args: { a: string }) => ({ ok: true as const, args }),
      apply: async () => undefined,
    };
    expect(() => defineMutationTool(spec)).toThrow(/strict/i);
  });
});
