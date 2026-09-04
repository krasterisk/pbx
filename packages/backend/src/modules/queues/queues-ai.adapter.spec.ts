import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { QueuesAiAdapter } from './queues-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const QUEUE_A = {
  name: 'q100_100',
  exten: '100',
  display_name: 'Sales',
  strategy: 'ringall',
  timeout: 30,
  context: 'from-internal',
  members: [
    { interface: 'PJSIP/e201_100', membername: 'Alice', penalty: 0 },
    { interface: 'PJSIP/e203_100', membername: 'Bob', penalty: 0 },
  ],
};

const QUEUE_B = {
  name: 'q500_200',
  exten: '500',
  display_name: 'Other',
  strategy: 'leastrecent',
  timeout: 15,
  context: 'sip-out',
  members: [{ interface: 'PJSIP/e500_200', membername: 'Other', penalty: 0 }],
};

function confirmAs<T>(
  role: UserLevel,
  apply: () => Promise<T>,
): Promise<{ ok: boolean; reason?: string; result?: T }> {
  if (role === UserLevel.READONLY) {
    return Promise.resolve({ ok: false, reason: 'denied' });
  }
  return apply().then((result) => ({ ok: true, result }));
}

describe('QueuesAiAdapter', () => {
  let queuesService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let contextsService: { findAll: jest.Mock };
  let endpointsService: { findAll: jest.Mock };
  let routeReferencesService: { findUsage: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: QueuesAiAdapter;
  const updatedRows: Array<{ name: string; dto: Record<string, unknown>; tenant: number }> = [];

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    updatedRows.length = 0;
    queuesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...QUEUE_A, memberCount: 2 }];
        if (uid === TENANT_B) return [{ ...QUEUE_B, memberCount: 1 }];
        return [];
      }),
      findOne: jest.fn(async (name: string, uid: number) => {
        if (uid === TENANT_A && name === QUEUE_A.name) return { ...QUEUE_A };
        if (uid === TENANT_B && name === QUEUE_B.name) return { ...QUEUE_B };
        throw new NotFoundException(`Queue "${name}" not found`);
      }),
      create: jest.fn(),
      update: jest.fn(async (name: string, dto: Record<string, unknown>, uid: number) => {
        await queuesService.findOne(name, uid);
        updatedRows.push({ name, dto, tenant: uid });
        return { ...QUEUE_A, ...dto, name };
      }),
      remove: jest.fn(),
    };
    contextsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ uid: 1, name: 'from-internal' }, { uid: 3, name: 'night' }];
        if (uid === TENANT_B) return [{ uid: 2, name: 'sip-out' }];
        return [];
      }),
    };
    endpointsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) {
          return [
            { extension: '201', sipUsername: 'e201_100' },
            { extension: '203', sipUsername: 'e203_100' },
          ];
        }
        if (uid === TENANT_B) return [{ extension: '500', sipUsername: 'e500_200' }];
        return [];
      }),
    };
    routeReferencesService = {
      findUsage: jest.fn(async () => ({
        references: [
          { host: 'route', routeName: 'Inbound Sales', routeUid: 11 },
          { host: 'ivr', ivrName: 'Main', ivrUid: 7, menuDigit: '1' },
        ],
      })),
    };
    registry = { register: jest.fn() };
    adapter = new QueuesAiAdapter(
      queuesService as any,
      registry as any,
      contextsService as any,
      endpointsService as any,
      routeReferencesService as any,
    );
  });

  describe('tool declarations (D-18)', () => {
    it('exposes list, create, update and delete', () => {
      expect(adapter.getTools().map((tool) => tool.name)).toEqual([
        'list_queues',
        'create_queue',
        'update_queue',
        'delete_queue',
      ]);
    });

    it('marks update as proposing and delete as destructive', () => {
      expect(getTool('update_queue').proposes).toBe(true);
      expect(getTool('create_queue').proposes).toBe(true);
      expect(getTool('delete_queue').proposes).toBe(true);
      expect(getTool('delete_queue').destructive).toBe(true);
    });
  });

  describe('list_queues (D-15)', () => {
    it('returns strategy, timeout and membership and does not mutate', async () => {
      const result = await getTool('list_queues').handler({}, TENANT_A);

      expect(queuesService.create).not.toHaveBeenCalled();
      expect(queuesService.update).not.toHaveBeenCalled();
      expect(queuesService.remove).not.toHaveBeenCalled();
      expect(result.queues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'q100_100',
            strategy: 'ringall',
            timeout: 30,
            members: expect.arrayContaining([
              expect.objectContaining({ membername: 'Alice' }),
            ]),
          }),
        ]),
      );
    });
  });

  describe('update_queue (D-18, D-27)', () => {
    it('returns a proposal whose summary names changed settings with old and new values', async () => {
      const result = await getTool('update_queue').handler(
        { name: 'q100_100', timeout: 45 },
        TENANT_A,
      );

      expect(queuesService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'update_queue' }));
      const card = result.summary.join(' ');
      expect(card).toMatch(/30/);
      expect(card).toMatch(/45/);
    });

    it('refuses an overflow destination that does not exist for the tenant', async () => {
      const result = await getTool('update_queue').handler(
        { name: 'q100_100', overflow: 'gone-context' },
        TENANT_A,
      );

      expect(queuesService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toBeUndefined();
      expect(result.refused).toBe(true);
      expect(JSON.stringify(result)).toMatch(/gone-context/);
    });

    it('names the queue current member agents when strategy or membership changes', async () => {
      const result = await getTool('update_queue').handler(
        { name: 'q100_100', strategy: 'rrmemory' },
        TENANT_A,
      );

      const card = result.summary.join(' ');
      expect(card).toMatch(/Alice/);
      expect(card).toMatch(/Bob/);
      expect(card).toMatch(/ringall/);
      expect(card).toMatch(/rrmemory/);
    });

    it('passes the queue name and tenant separately and does not write until confirm', async () => {
      const proposal = await getTool('update_queue').handler(
        { name: 'q100_100', timeout: 45 },
        TENANT_A,
      );
      expect(updatedRows).toHaveLength(0);

      const { name, ...rest } = proposal.applyPayload.args;
      await queuesService.update(String(name), rest, TENANT_A);

      expect(updatedRows).toHaveLength(1);
      expect(updatedRows[0].name).toBe('q100_100');
      expect(updatedRows[0].tenant).toBe(TENANT_A);
    });
  });

  describe('delete_queue (T-15-46)', () => {
    it('is destructive and names the routes and menus that feed the queue', async () => {
      const result = await getTool('delete_queue').handler({ name: 'q100_100' }, TENANT_A);

      expect(queuesService.remove).not.toHaveBeenCalled();
      expect(routeReferencesService.findUsage).toHaveBeenCalled();
      const card = result.summary.join(' ');
      expect(card).toMatch(/Inbound Sales/);
      expect(card).toMatch(/Main/);
    });
  });

  describe('create_queue', () => {
    it('returns a pending proposal and does not write', async () => {
      const result = await getTool('create_queue').handler(
        { name: 'Support', exten: '200', strategy: 'ringall', timeout: 20, overflow: 'from-internal' },
        TENANT_A,
      );

      expect(queuesService.create).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'create_queue' }));
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with the adapter registry', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('queue domain skill', () => {
    it('ships two-field frontmatter covering strategies, timeout, overflow, membership and live state', () => {
      const skillPath = path.join(__dirname, '../../skills/queues/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: queues\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/ringall|leastrecent|strategy|стратег/i);
      expect(raw).toMatch(/timeout|таймаут/i);
      expect(raw).toMatch(/overflow|переполн|context/i);
      expect(raw).toMatch(/member|агент|член/i);
      expect(raw).toMatch(/get_pbx_state|live|состояни/i);
    });
  });
});
