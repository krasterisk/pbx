import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { EndpointsAiAdapter } from './endpoints-ai.adapter';
import { EndpointsService } from './endpoints.service';

const TENANT_A = 100;
const TENANT_B = 200;
const GENERATED_SECRET = 'GEN_SECRET_9xQ2';

function confirmAs<T>(
  role: UserLevel,
  apply: () => Promise<T>,
): Promise<{ ok: boolean; reason?: string; result?: T }> {
  if (role === UserLevel.READONLY) {
    return Promise.resolve({ ok: false, reason: 'denied' });
  }
  return apply().then((result) => ({ ok: true, result }));
}

function assertNoCredentialLeak(value: unknown): void {
  const text = JSON.stringify(value);
  expect(text).not.toContain(GENERATED_SECRET);
  expect(text).not.toMatch(/"password"\s*:/);
  expect(text.toLowerCase()).not.toMatch(/пароль\s*[:=]/);
}

describe('EndpointsAiAdapter', () => {
  let endpointsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    createWithGeneratedCredentials: jest.Mock;
    bulkCreate: jest.Mock;
    remove: jest.Mock;
  };
  let registry: { register: jest.Mock };
  let adapter: EndpointsAiAdapter;
  const createdRows: Array<{ dto: Record<string, unknown>; uid: number }> = [];

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    createdRows.length = 0;
    endpointsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) {
          return [
            { extension: '201', context: 'from-internal', sipUsername: 'e201_100', callerid: '"Alice" <201>' },
            { extension: '203', context: 'from-internal', sipUsername: 'e203_100', callerid: '"Bob" <203>' },
          ];
        }
        if (uid === TENANT_B) {
          return [{ extension: '500', context: 'sip-out', sipUsername: 'e500_200', callerid: '"Other" <500>' }];
        }
        return [];
      }),
      findOne: jest.fn(),
      create: jest.fn(),
      createWithGeneratedCredentials: jest.fn(async (dto: Record<string, unknown>, uid: number) => {
        createdRows.push({ dto, uid });
        return { extension: dto.extension, sipUsername: `e${dto.extension}_${uid}`, context: dto.context };
      }),
      bulkCreate: jest.fn(),
      remove: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new EndpointsAiAdapter(endpointsService as any, registry as any);
  });

  describe('list_endpoints', () => {
    it('returns public extensions without SIP ids and can filter 101-103 style ranges', async () => {
      const listed = await getTool('list_endpoints').handler({}, TENANT_A);
      expect(listed.endpoints).toEqual([
        expect.objectContaining({ extension: '201', context: 'from-internal' }),
        expect.objectContaining({ extension: '203' }),
      ]);
      expect(JSON.stringify(listed)).not.toMatch(/e201_100|sipUsername/);

      const filtered = await getTool('list_endpoints').handler({ extensions: '201' }, TENANT_A);
      expect(filtered.endpoints).toHaveLength(1);
      expect(filtered.endpoints[0].extension).toBe('201');
    });
  });

  describe('create_endpoint (D-18, D-27)', () => {
    it('marks create_endpoint as a proposing tool', () => {
      const tool = getTool('create_endpoint');
      expect(tool).toBeDefined();
      expect(tool.proposes).toBe(true);
      expect(tool.destructive).toBeFalsy();
      expect(tool.entityType).toBe('endpoint');
    });

    it('returns a pending proposal naming the extension and context and creates no subscriber row', async () => {
      const result = await getTool('create_endpoint').handler(
        { extension: '210', name: 'Desk', context: 'from-internal' },
        TENANT_A,
      );

      expect(endpointsService.create).not.toHaveBeenCalled();
      expect(endpointsService.createWithGeneratedCredentials).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          entityType: 'endpoint',
          entityLabel: expect.stringMatching(/210|Desk/),
          summary: expect.arrayContaining([expect.stringMatching(/210/)]),
          applyPayload: expect.objectContaining({
            tool: 'create_endpoint',
            args: expect.objectContaining({ extension: '210', context: 'from-internal' }),
          }),
        }),
      );
      expect(result.summary.join(' ')).toMatch(/210/);
      expect(result.summary.join(' ')).toMatch(/from-internal/);
    });

    it('normalizes a tenant-scoped SIP id to the public extension of the dispatch tenant', async () => {
      const result = await getTool('create_endpoint').handler(
        { extension: 'e210_100', name: 'Desk' },
        TENANT_A,
      );

      expect(result.applyPayload.args).toEqual(expect.objectContaining({ extension: '210' }));
      expect(JSON.stringify(result.applyPayload.args)).not.toMatch(/e210_100|vpbxUserUid|tenantId/);
    });

    it('never places a generated credential in the proposal summary or the tool result', async () => {
      const result = await getTool('create_endpoint').handler(
        { extension: '210', name: 'Desk', password: GENERATED_SECRET },
        TENANT_A,
      );

      assertNoCredentialLeak(result);
      expect(result.summary.join(' ')).toMatch(/абонент|экран|subscriber|screen/i);
    });

    it('derives the next free extension and the default context from the calling tenant\'s own data', async () => {
      const forA = await getTool('create_endpoint').handler({ name: 'Next A' }, TENANT_A);
      const forB = await getTool('create_endpoint').handler({ name: 'Next B' }, TENANT_B);

      expect(endpointsService.findAll).toHaveBeenNthCalledWith(1, TENANT_A);
      expect(endpointsService.findAll).toHaveBeenNthCalledWith(2, TENANT_B);
      expect(forA.applyPayload.args.extension).toBe('204');
      expect(forA.applyPayload.args.context).toBe('from-internal');
      expect(forB.applyPayload.args.extension).toBe('501');
      expect(forB.applyPayload.args.context).toBe('sip-out');
      expect(forA.summary.join(' ')).not.toContain('500');
      expect(forB.summary.join(' ')).not.toContain('201');
    });

    it('confirming the proposal creates exactly one subscriber for the calling tenant', async () => {
      const proposal = await getTool('create_endpoint').handler({ name: 'Desk' }, TENANT_A);
      expect(createdRows).toHaveLength(0);

      const created = await endpointsService.createWithGeneratedCredentials(proposal.applyPayload.args, TENANT_A);

      expect(createdRows).toHaveLength(1);
      expect(createdRows[0].uid).toBe(TENANT_A);
      expect(createdRows[0].dto.extension).toBe('204');
      expect(created).toEqual(expect.objectContaining({ extension: '204', sipUsername: 'e204_100' }));
      assertNoCredentialLeak(created);
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with the adapter registry', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('create_endpoints_bulk (D-18, D-21)', () => {
    it('returns one proposal for the whole batch with a per-item summary and a stated total', async () => {
      const result = await getTool('create_endpoints_bulk').handler(
        { extensionsPattern: '210-212', displayNamePattern: 'Абонент {N}' },
        TENANT_A,
      );

      expect(endpointsService.bulkCreate).not.toHaveBeenCalled();
      expect(endpointsService.create).not.toHaveBeenCalled();
      expect(result.proposes ?? getTool('create_endpoints_bulk').proposes).toBe(true);
      expect(result).toEqual(
        expect.objectContaining({
          entityType: 'endpoint',
          applyPayload: expect.objectContaining({ tool: 'create_endpoints_bulk' }),
        }),
      );
      const card = result.summary.join('\n');
      expect(card).toMatch(/всего 3|3 абонент/i);
      expect(card).toMatch(/210/);
      expect(card).toMatch(/211/);
      expect(card).toMatch(/212/);
      assertNoCredentialLeak(result);
    });

    it('refuses a batch above the documented ceiling and names that ceiling', async () => {
      const result = await getTool('create_endpoints_bulk').handler(
        { startExtension: '200', count: 51 },
        TENANT_A,
      );

      expect(endpointsService.bulkCreate).not.toHaveBeenCalled();
      const text = JSON.stringify(result);
      expect(text).toMatch(/50/);
      expect(result.applyPayload).toBeUndefined();
    });
  });

  describe('delete_endpoint (D-18, D-21, D-22)', () => {
    it('is declared destructive and names the subscriber being removed', async () => {
      endpointsService.findOne.mockResolvedValue({
        extension: '201',
        sipUsername: 'e201_100',
        endpoint: { callerid: '"Alice" <201>' },
      });

      const tool = getTool('delete_endpoint');
      expect(tool.destructive).toBe(true);
      expect(tool.proposes).toBe(true);

      const result = await tool.handler({ sipId: 'e201_100' }, TENANT_A);

      expect(endpointsService.remove).not.toHaveBeenCalled();
      expect(endpointsService.findOne).toHaveBeenCalledWith('e201_100', TENANT_A);
      expect(result.summary.join(' ')).toMatch(/201/);
      expect(result.summary.join(' ')).toMatch(/Alice/);
    });

    it('confirming a delete proposal for a subscriber of another tenant is not found', async () => {
      endpointsService.findOne.mockImplementation(async (sipId: string, uid: number) => {
        if (uid !== TENANT_A || sipId !== 'e201_100') {
          throw new NotFoundException('Endpoint not found');
        }
        return { extension: '201', sipUsername: 'e201_100', endpoint: { callerid: '"Alice" <201>' } };
      });
      endpointsService.remove.mockImplementation(async (sipId: string, uid: number) => {
        if (uid !== TENANT_A || sipId !== 'e201_100') {
          throw new NotFoundException('Endpoint not found');
        }
      });

      await expect(getTool('delete_endpoint').handler({ sipId: 'e201_200' }, TENANT_A)).rejects.toThrow(
        /not found/i,
      );
      await expect(endpointsService.remove('e201_200', TENANT_A)).rejects.toThrow(/not found/i);
      expect(endpointsService.remove).toHaveBeenCalledWith('e201_200', TENANT_A);
    });
  });

  describe('role fixtures on confirmation (D-21)', () => {
    it('denies a read-only role confirming bulk create and changes no rows', async () => {
      const proposal = await getTool('create_endpoints_bulk').handler(
        { extensionsPattern: '210-211' },
        TENANT_A,
      );
      const denied = await confirmAs(UserLevel.READONLY, async () =>
        endpointsService.bulkCreate(proposal.applyPayload.args, TENANT_A),
      );

      expect(denied).toEqual({ ok: false, reason: 'denied' });
      expect(endpointsService.bulkCreate).not.toHaveBeenCalled();
    });

    it('denies a read-only role confirming delete and changes no rows', async () => {
      endpointsService.findOne.mockResolvedValue({
        extension: '201',
        sipUsername: 'e201_100',
        endpoint: { callerid: '"Alice" <201>' },
      });
      const proposal = await getTool('delete_endpoint').handler({ sipId: 'e201_100' }, TENANT_A);
      const denied = await confirmAs(UserLevel.READONLY, async () =>
        endpointsService.remove(proposal.applyPayload.args.sipId, TENANT_A),
      );

      expect(denied).toEqual({ ok: false, reason: 'denied' });
      expect(endpointsService.remove).not.toHaveBeenCalled();
    });

    it('allows an admin role to confirm bulk create', async () => {
      const proposal = await getTool('create_endpoints_bulk').handler(
        { extensionsPattern: '210-211' },
        TENANT_A,
      );
      const allowed = await confirmAs(UserLevel.ADMIN, async () =>
        endpointsService.bulkCreate(proposal.applyPayload.args, TENANT_A),
      );

      expect(allowed.ok).toBe(true);
      expect(endpointsService.bulkCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscriber domain skill', () => {
    it('ships two-field frontmatter covering extensions, contexts and fields the agent must ask about', () => {
      const skillPath = path.join(__dirname, '../../skills/endpoints/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: endpoints\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/extension|внутренн/i);
      expect(raw).toMatch(/context|контекст/i);
      expect(raw).toMatch(/спроси|ask|не угад/i);
      expect(raw).toMatch(/назвал|указал|exact/i);
      expect(raw).toMatch(/list_endpoints/);
      expect(raw).toMatch(/чеклист|рецепт/i);
    });
  });
});

describe('EndpointsService.createWithGeneratedCredentials', () => {
  it('generates the credential in the service, stores it, and returns the subscriber without the secret', async () => {
    const service = Object.create(EndpointsService.prototype) as EndpointsService;
    (service as any).generatePassword = jest.fn(() => GENERATED_SECRET);
    (service as any).create = jest.fn(async (dto: { password: string; extension: string }, uid: number) => ({
      extension: dto.extension,
      sipUsername: `e${dto.extension}_${uid}`,
      password: dto.password,
    }));

    const result = await service.createWithGeneratedCredentials(
      { extension: '201', context: 'from-internal', displayName: 'Alice' } as any,
      TENANT_A,
    );

    expect((service as any).create).toHaveBeenCalledTimes(1);
    expect((service as any).create).toHaveBeenCalledWith(
      expect.objectContaining({ extension: '201', password: GENERATED_SECRET }),
      TENANT_A,
      undefined,
    );
    expect(result).not.toHaveProperty('password');
    assertNoCredentialLeak(result);
  });
});
