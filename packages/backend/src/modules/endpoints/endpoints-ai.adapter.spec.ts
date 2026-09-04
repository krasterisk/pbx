import * as fs from 'fs';
import * as path from 'path';
import { EndpointsAiAdapter } from './endpoints-ai.adapter';
import { EndpointsService } from './endpoints.service';

const TENANT_A = 100;
const TENANT_B = 200;
const GENERATED_SECRET = 'GEN_SECRET_9xQ2';

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

  describe('subscriber domain skill', () => {
    it('ships two-field frontmatter covering extensions, contexts and fields the agent must ask about', () => {
      const skillPath = path.join(__dirname, '../../skills/endpoints/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: endpoints\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/extension|внутренн/i);
      expect(raw).toMatch(/context|контекст/i);
      expect(raw).toMatch(/спроси|ask|не угад/i);
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
