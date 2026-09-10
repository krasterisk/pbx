import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import type { AgentDiffProposal } from '../ai-platform/ai-adapter.types';
import { CallGroupsAiAdapter } from '../call-groups/call-groups-ai.adapter';
import { DirectoriesAiAdapter } from '../directories/directories-ai.adapter';
import { EndpointsAiAdapter, parseBulkExtensions } from '../endpoints/endpoints-ai.adapter';
import { IvrsAiAdapter } from '../ivrs/ivrs-ai.adapter';
import { QueuesAiAdapter } from '../queues/queues-ai.adapter';
import { RoutesAiAdapter } from '../routes/routes-ai.adapter';
import { TrunksAiAdapter } from '../trunks/trunks-ai.adapter';
import { PbxWorkflowCompilerService } from './pbx-workflow-compiler.service';

const TENANT = 100;
const CTX = { vpbxUserUid: TENANT, userUid: 11, role: 1, isAdmin: true };

type World = {
  endpoints: Array<{ extension: string; sipUsername: string; context: string; vpbx_user_uid: number }>;
  groups: Array<{ uid: number; name: string; exten: string; strategy: string; members: unknown[]; vpbx_user_uid: number }>;
  ivrs: Array<{ uid: number; name: string; menu_items: unknown[]; vpbx_user_uid: number }>;
  queues: Array<{ name: string; exten: string; display_name: string; strategy: string; timeout: number; members: unknown[]; vpbx_user_uid: number }>;
  routes: Array<{ uid: number; context_uid: number; name: string; extensions: string[]; actions: unknown[]; vpbx_user_uid: number }>;
  trunks: Array<{ id: string; name: string; host: string; vpbx_user_uid: number }>;
  directories: Array<{ uid: number; name: string; lookupFieldKey: string; fields: unknown[]; records: unknown[]; vpbx_user_uid: number }>;
  contexts: Array<{ uid: number; name: string; vpbx_user_uid: number }>;
};

function createWorld(): World {
  return {
    endpoints: [],
    groups: [],
    ivrs: [],
    queues: [],
    routes: [],
    trunks: [],
    directories: [],
    contexts: [
      { uid: 10, name: 'from-internal', vpbx_user_uid: TENANT },
      { uid: 11, name: 'from-trunk', vpbx_user_uid: TENANT },
    ],
  };
}

function notFound(label: string): never {
  throw new Error(`${label} not found`);
}

function wire(world: World) {
  const registry = new AiAdapterRegistryService();
  const routeReferencesService = { findUsage: async () => ({ references: [] }) };

  const endpointsService = {
    findAll: async (uid: number) => world.endpoints.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (sipId: string, uid: number) =>
      world.endpoints.find((row) => row.sipUsername === sipId && row.vpbx_user_uid === uid)
      ?? notFound(`endpoint ${sipId}`),
    createWithGeneratedCredentials: async (args: { extension: string; context: string }, uid: number) => {
      const row = {
        extension: args.extension,
        sipUsername: `e${args.extension}_${uid}`,
        context: args.context,
        vpbx_user_uid: uid,
      };
      world.endpoints.push(row);
      return row;
    },
    bulkCreate: async (args: { extensionsPattern: string; context: string }, uid: number) => {
      for (const extension of parseBulkExtensions(args.extensionsPattern)) {
        world.endpoints.push({
          extension,
          sipUsername: `e${extension}_${uid}`,
          context: args.context,
          vpbx_user_uid: uid,
        });
      }
    },
    remove: async (sipId: string, uid: number) => {
      const index = world.endpoints.findIndex((row) => row.sipUsername === sipId && row.vpbx_user_uid === uid);
      if (index >= 0) world.endpoints.splice(index, 1);
    },
  };

  const callGroupsService = {
    findAll: async (uid: number) => world.groups.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (groupUid: number, uid: number) =>
      world.groups.find((row) => row.uid === groupUid && row.vpbx_user_uid === uid)
      ?? notFound(`group ${groupUid}`),
    checkExtenConflict: async (exten: string, uid: number) =>
      world.groups.some((row) => row.exten === exten && row.vpbx_user_uid === uid)
      || world.endpoints.some((row) => row.extension === exten && row.vpbx_user_uid === uid)
      || world.queues.some((row) => row.exten === exten && row.vpbx_user_uid === uid),
    create: async (args: { name: string; exten: string; strategy?: string; members?: unknown[] }, uid: number) => {
      const row = {
        uid: world.groups.length + 1,
        name: args.name,
        exten: args.exten,
        strategy: args.strategy ?? 'ringall',
        members: args.members ?? [],
        vpbx_user_uid: uid,
      };
      world.groups.push(row);
      return row;
    },
    update: async (groupUid: number, args: { members?: unknown[] }, uid: number) => {
      const row = world.groups.find((item) => item.uid === groupUid && item.vpbx_user_uid === uid);
      if (!row) notFound(`group ${groupUid}`);
      if (args.members) row.members = args.members;
      return row;
    },
    remove: async (groupUid: number, uid: number) => {
      const index = world.groups.findIndex((row) => row.uid === groupUid && row.vpbx_user_uid === uid);
      if (index >= 0) world.groups.splice(index, 1);
    },
  };

  const ivrsService = {
    findAll: async (uid: number) => world.ivrs.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (id: number, uid: number) =>
      world.ivrs.find((row) => row.uid === id && row.vpbx_user_uid === uid) ?? notFound(`ivr ${id}`),
    create: async (args: { name: string; menu_items?: unknown[] }, uid: number) => {
      const row = {
        uid: world.ivrs.length + 1,
        name: args.name,
        menu_items: args.menu_items ?? [],
        vpbx_user_uid: uid,
      };
      world.ivrs.push(row);
      return row;
    },
    update: async (id: number, args: { name?: string; menu_items?: unknown[] }, uid: number) => {
      const row = world.ivrs.find((item) => item.uid === id && item.vpbx_user_uid === uid);
      if (!row) notFound(`ivr ${id}`);
      if (args.name) row.name = args.name;
      if (args.menu_items) row.menu_items = args.menu_items;
      return row;
    },
    remove: async (id: number, uid: number) => {
      const index = world.ivrs.findIndex((row) => row.uid === id && row.vpbx_user_uid === uid);
      if (index >= 0) world.ivrs.splice(index, 1);
    },
  };

  const queuesService = {
    findAll: async (uid: number) => world.queues.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (name: string, uid: number) =>
      world.queues.find((row) => row.name === name && row.vpbx_user_uid === uid) ?? notFound(`queue ${name}`),
    create: async (args: Record<string, unknown>, uid: number) => {
      const row = {
        name: String(args.exten ?? args.name),
        exten: String(args.exten ?? args.name),
        display_name: String(args.display_name ?? args.name),
        strategy: String(args.strategy ?? 'ringall'),
        timeout: Number(args.timeout ?? 30),
        members: Array.isArray(args.members) ? args.members : [],
        vpbx_user_uid: uid,
      };
      world.queues.push(row);
      return row;
    },
    update: async (name: string, args: Record<string, unknown>, uid: number) => {
      const row = world.queues.find((item) => item.name === name && item.vpbx_user_uid === uid);
      if (!row) notFound(`queue ${name}`);
      if (args.timeout != null) row.timeout = Number(args.timeout);
      if (args.strategy) row.strategy = String(args.strategy);
      if (Array.isArray(args.members)) row.members = args.members;
      return row;
    },
    remove: async (name: string, uid: number) => {
      const index = world.queues.findIndex((row) => row.name === name && row.vpbx_user_uid === uid);
      if (index >= 0) world.queues.splice(index, 1);
    },
  };

  const routesService = {
    findAll: async (uid: number) => world.routes.filter((row) => row.vpbx_user_uid === uid),
    findAllByContext: async (contextUid: number, uid: number) =>
      world.routes.filter((row) => row.context_uid === contextUid && row.vpbx_user_uid === uid),
    findOne: async (id: number, uid: number) =>
      world.routes.find((row) => row.uid === id && row.vpbx_user_uid === uid) ?? notFound(`route ${id}`),
    create: async (args: { context_uid: number; name: string; extensions: string[]; actions: unknown[] }, uid: number) => {
      const row = {
        uid: world.routes.length + 1,
        context_uid: args.context_uid,
        name: args.name,
        extensions: args.extensions,
        actions: args.actions,
        vpbx_user_uid: uid,
      };
      world.routes.push(row);
      return row;
    },
    remove: async (id: number, uid: number) => {
      const index = world.routes.findIndex((row) => row.uid === id && row.vpbx_user_uid === uid);
      if (index >= 0) world.routes.splice(index, 1);
    },
  };

  const trunksService = {
    findAll: async (uid: number) => world.trunks.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (id: string, uid: number) =>
      world.trunks.find((row) => row.id === id && row.vpbx_user_uid === uid) ?? notFound(`trunk ${id}`),
    create: async (args: { name: string; host?: string }, uid: number) => {
      const row = { id: `t_${args.name}_${uid}`, name: args.name, host: args.host ?? '', vpbx_user_uid: uid };
      world.trunks.push(row);
      return row;
    },
    remove: async (id: string, uid: number) => {
      const index = world.trunks.findIndex((row) => row.id === id && row.vpbx_user_uid === uid);
      if (index >= 0) world.trunks.splice(index, 1);
    },
  };

  const directoriesService = {
    findAll: async (uid: number) => world.directories.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (directoryUid: number, uid: number) =>
      world.directories.find((row) => row.uid === directoryUid && row.vpbx_user_uid === uid)
      ?? notFound(`directory ${directoryUid}`),
    create: async (args: { name: string; lookupFieldKey: string; fields?: unknown[]; records?: unknown[] }, uid: number) => {
      const row = {
        uid: world.directories.length + 1,
        name: args.name,
        lookupFieldKey: args.lookupFieldKey,
        fields: args.fields ?? [],
        records: args.records ?? [],
        vpbx_user_uid: uid,
      };
      world.directories.push(row);
      return row;
    },
    update: async (directoryUid: number, args: { name?: string; records?: unknown[] }, uid: number) => {
      const row = world.directories.find((item) => item.uid === directoryUid && item.vpbx_user_uid === uid);
      if (!row) notFound(`directory ${directoryUid}`);
      if (args.name) row.name = args.name;
      if (args.records) row.records = args.records;
      return row;
    },
    remove: async (directoryUid: number, uid: number) => {
      const index = world.directories.findIndex((row) => row.uid === directoryUid && row.vpbx_user_uid === uid);
      if (index >= 0) world.directories.splice(index, 1);
    },
  };

  const contextsService = {
    findAll: async (uid: number) => world.contexts.filter((row) => row.vpbx_user_uid === uid),
    findOne: async (contextUid: number, uid: number) =>
      world.contexts.find((row) => row.uid === contextUid && row.vpbx_user_uid === uid)
      ?? notFound(`context ${contextUid}`),
  };

  new EndpointsAiAdapter(endpointsService as never, registry).onModuleInit();
  new DirectoriesAiAdapter(directoriesService as never, registry).onModuleInit();
  new QueuesAiAdapter(
    queuesService as never,
    registry,
    contextsService as never,
    endpointsService as never,
    routeReferencesService as never,
  ).onModuleInit();
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
  new RoutesAiAdapter(
    routesService as never,
    contextsService as never,
    queuesService as never,
    endpointsService as never,
    trunksService as never,
    ivrsService as never,
    directoriesService as never,
    callGroupsService as never,
    registry,
  ).onModuleInit();

  const tool = (name: string) => {
    const found = registry.getAllTools().find((row) => row.name === name);
    if (!found) throw new Error(`tool not registered: ${name}`);
    return found;
  };

  const apply = async (name: string, input: Record<string, unknown>) => {
    const found = tool(name);
    const proposed = await found.handler(input, TENANT) as AgentDiffProposal & { refused?: boolean; message?: string };
    if (proposed.refused) {
      throw new Error(`${name} refused: ${JSON.stringify(proposed)}`);
    }
    const args = proposed.applyPayload.args;
    const checked = found.mutation
      ? await found.mutation.revalidate(args, CTX)
      : { ok: true as const, args };
    if (!checked.ok) throw new Error(`${name} revalidate: ${checked.reason}`);
    await found.mutation!.apply(checked.args, CTX);
    return { proposed, args: checked.args };
  };

  return { world, apply, registry };
}

describe('typical PBX setups', () => {
  it('configures a reception office: subscribers, ring group, IVR, inbound route, then tears it down', async () => {
    const { world, apply } = wire(createWorld());

    await apply('create_endpoints_bulk', {
      extensionsPattern: '321-323',
      context: 'from-internal',
    });
    expect(world.endpoints.map((row) => row.extension)).toEqual(['321', '322', '323']);

    await apply('create_call_group', {
      name: 'Приёмная',
      exten: '9032',
      members: [
        { member_type: 'internal', value: '321' },
        { member_type: 'internal', value: '322' },
        { member_type: 'internal', value: '323' },
      ],
    });
    expect(world.groups[0]).toEqual(expect.objectContaining({ name: 'Приёмная', exten: '9032' }));

    await apply('create_ivr', {
      name: 'Приёмная',
      menu_items: [
        { digit: '1', destination: { kind: 'extension', target: '321' } },
        { digit: '2', destination: { kind: 'extension', target: '322' } },
        { digit: '3', destination: { kind: 'extension', target: '323' } },
        { digit: 't', destination: { kind: 'group', target: world.groups[0].uid } },
      ],
    });
    expect(world.ivrs[0].name).toBe('Приёмная');

    await apply('create_route', {
      context_uid: 11,
      pattern: '74951230000',
      name: 'DID Приёмная',
      actions: [{ type: 'toivr', params: { ivr_uid: world.ivrs[0].uid }, condition: {} }],
    });
    expect(world.routes[0].extensions).toEqual(['74951230000']);

    await apply('update_ivr', {
      id: world.ivrs[0].uid,
      menu_items: [
        { digit: '1', destination: { kind: 'extension', target: '321' } },
        { digit: '2', destination: { kind: 'extension', target: '322' } },
        { digit: '3', destination: { kind: 'group', target: world.groups[0].uid } },
        { digit: 't', destination: { kind: 'group', target: world.groups[0].uid } },
      ],
    });

    await apply('update_call_group_members', {
      uid: world.groups[0].uid,
      members: [
        { member_type: 'internal', value: '321' },
        { member_type: 'internal', value: '322' },
      ],
    });
    expect(world.groups[0].members).toHaveLength(2);

    await apply('delete_route', { id: world.routes[0].uid });
    await apply('delete_ivr', { id: world.ivrs[0].uid });
    await apply('delete_call_group', { uid: world.groups[0].uid });
    await apply('delete_endpoint', { sipId: '321' });
    await apply('delete_endpoint', { sipId: '322' });
    await apply('delete_endpoint', { sipId: '323' });

    expect(world.routes).toHaveLength(0);
    expect(world.ivrs).toHaveLength(0);
    expect(world.groups).toHaveLength(0);
    expect(world.endpoints).toHaveLength(0);
  });

  it('configures a contact center: agents, queues, IVR routing, overflow update, then teardown', async () => {
    const { world, apply } = wire(createWorld());

    await apply('create_endpoints_bulk', {
      extensionsPattern: '401-404',
      context: 'from-internal',
    });
    await apply('create_queue', {
      name: 'Sales',
      exten: '8001',
      strategy: 'leastrecent',
      timeout: 25,
      members: [{ interface: 'PJSIP/401' }, { interface: 'PJSIP/402' }],
    });
    await apply('create_queue', {
      name: 'Support',
      exten: '8002',
      strategy: 'ringall',
      timeout: 40,
      members: [{ interface: 'PJSIP/403' }, { interface: 'PJSIP/404' }],
    });
    expect(world.queues.map((row) => row.display_name)).toEqual(['Sales', 'Support']);

    await apply('update_queue', { name: '8001', timeout: 15, strategy: 'rrmemory' });
    expect(world.queues[0].timeout).toBe(15);

    await apply('create_ivr', {
      name: 'Контакт-центр',
      menu_items: [
        { digit: '1', destination: { kind: 'queue', target: '8001' } },
        { digit: '2', destination: { kind: 'queue', target: '8002' } },
        { digit: 't', destination: { kind: 'queue', target: '8002' } },
      ],
    });
    await apply('create_route', {
      context_uid: 11,
      pattern: '74951231111',
      actions: [{ type: 'toivr', params: { ivr_uid: world.ivrs[0].uid }, condition: {} }],
    });
    expect(world.routes[0].actions).toEqual([
      expect.objectContaining({ type: 'toivr' }),
    ]);

    await apply('delete_route', { id: world.routes[0].uid });
    await apply('delete_ivr', { id: world.ivrs[0].uid });
    await apply('delete_queue', { name: '8001' });
    await apply('delete_queue', { name: '8002' });
    expect(world.queues).toHaveLength(0);
    expect(world.ivrs).toHaveLength(0);
  });

  it('configures a trunk office: directory, SIP trunk, inbound and outbound routes, then teardown', async () => {
    const { world, apply } = wire(createWorld());

    await apply('create_endpoints_bulk', {
      extensionsPattern: '201-202',
      context: 'from-internal',
    });
    await apply('create_directory', {
      name: 'VIP',
      lookupFieldKey: 'num',
      fields: [{ key: 'num', label: 'Номер', type: 'phone', required: true, position: 0 }],
      records: [{ values: { num: '74950001111' } }],
    });
    expect(world.directories[0].name).toBe('VIP');

    await apply('create_trunk', { name: 'MTT', host: 'sip.mtt.example', trunkType: 'ip' });
    expect(world.trunks[0].id).toBe('t_MTT_100');

    await apply('create_route', {
      context_uid: 10,
      pattern: '_X.',
      name: 'Исход через MTT',
      actions: [{ type: 'totrunk', params: { trunk: 't_MTT_100' }, condition: {} }],
    });
    await apply('create_route', {
      context_uid: 11,
      pattern: '74951232222',
      name: 'DID офис',
      actions: [{ type: 'toexten', params: { target: { source: 'fixed', value: '201' } }, condition: {} }],
    });
    expect(world.routes).toHaveLength(2);
    expect(world.routes.map((row) => row.actions[0])).toEqual([
      expect.objectContaining({ type: 'totrunk' }),
      expect.objectContaining({ type: 'toexten' }),
    ]);

    await apply('delete_route', { id: world.routes[0].uid });
    await apply('delete_route', { id: world.routes[0].uid });
    await apply('delete_trunk', { trunkId: 't_MTT_100' });
    await apply('delete_directory', { uid: world.directories[0].uid });
    expect(world.trunks).toHaveLength(0);
    expect(world.directories).toHaveLength(0);
    expect(world.routes).toHaveLength(0);
  });

  it('compiles an IVR plan that still has to create subscribers and the timeout group', async () => {
    const world = createWorld();
    world.endpoints.push({
      extension: '101',
      sipUsername: 'e101_100',
      context: 'from-internal',
      vpbx_user_uid: TENANT,
    });
    const { registry } = wire(world);
    const compiler = new PbxWorkflowCompilerService(registry);
    const compiled = await compiler.compile(
      {
        title: 'IVR «Рога и копыта»',
        steps: [
          {
            id: 'endpoints',
            tool: 'create_endpoints_bulk',
            args: { extensionsPattern: '102-103', displayNamePattern: 'Абонент {N}' },
          },
          {
            id: 'group',
            tool: 'create_call_group',
            dependsOn: ['endpoints'],
            args: {
              name: 'Рога и копыта',
              exten: '6901',
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
              text: 'Здравствуйте, вы позвонили в Рога и копыта.',
              menu_items: [
                { digit: '1', destination: { kind: 'extension', target: '101' } },
                { digit: '2', destination: { kind: 'extension', target: '102' } },
                { digit: '3', destination: { kind: 'extension', target: '103' } },
                { digit: 't', destination: { kind: 'group', target: '6901' } },
              ],
            },
          },
        ],
      },
      { vpbxUserUid: TENANT, userUid: 11, role: 1 },
    );
    expect(compiled.steps.map((step) => step.tool)).toEqual([
      'create_endpoints_bulk',
      'create_call_group',
      'create_ivr',
    ]);
    expect(compiled.summary.join(' ')).toMatch(/Рога и копыта|абонент/i);
  });

  it('drops the subscriber step when 101-103 already exist', async () => {
    const world = createWorld();
    for (const extension of ['101', '102', '103']) {
      world.endpoints.push({
        extension,
        sipUsername: `e${extension}_100`,
        context: 'from-internal',
        vpbx_user_uid: TENANT,
      });
    }
    const { registry } = wire(world);
    const compiler = new PbxWorkflowCompilerService(registry);
    const compiled = await compiler.compile(
      {
        title: 'IVR «Рога и копыта»',
        steps: [
          {
            id: 'endpoints',
            tool: 'create_endpoints_bulk',
            args: { extensionsPattern: '101-103' },
          },
          {
            id: 'group',
            tool: 'create_call_group',
            dependsOn: ['endpoints'],
            args: {
              name: 'Рога и копыта',
              exten: '9010',
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
              text: 'Здравствуйте, вы позвонили в Рога и копыта.',
              menu_items: [
                { digit: '1', destination: { kind: 'extension', target: '101' } },
                { digit: 't', destination: { kind: 'group', target: '9010' } },
              ],
            },
          },
        ],
      },
      { vpbxUserUid: TENANT, userUid: 11, role: 1 },
    );
    expect(compiled.steps.map((step) => step.tool)).toEqual(['create_call_group', 'create_ivr']);
    expect(compiled.steps[0].dependsOn).toEqual([]);
    expect(compiled.summary.join('\n')).toMatch(/таймаут → группа 9010/);
    expect(compiled.summary.join('\n')).toMatch(/1 → абонент 101/);
    expect(compiled.summary.join('\n')).not.toMatch(/engine_uid|extension 101/);
  });
});
