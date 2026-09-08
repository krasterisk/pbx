import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { TrunksAiAdapter, confirmTrunkDelete } from './trunks-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

describe('TrunksAiAdapter', () => {
  let trunksService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let routesService: { findAll: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: TrunksAiAdapter;

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    trunksService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) {
          return [{ id: 't_mtt_100', name: 'MTT', host: 'sip.mtt.ru', trunkType: 'auth' }];
        }
        if (uid === TENANT_B) {
          return [{ id: 't_other_200', name: 'Other', host: 'sip.other.test', trunkType: 'ip' }];
        }
        return [];
      }),
      findOne: jest.fn(async (trunkId: string, uid: number) => {
        const rows = await trunksService.findAll(uid);
        const found = rows.find((row) => row.id === trunkId);
        if (!found) throw new NotFoundException('Trunk not found');
        return found;
      }),
      create: jest.fn(),
      remove: jest.fn(),
    };
    routesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) {
          return [
            {
              uid: 11,
              name: 'Inbound sales',
              actions: [{ type: 'totrunk', params: { trunk: 'PJSIP/t_mtt_100' } }],
            },
          ];
        }
        return [];
      }),
    };
    registry = { register: jest.fn() };
    adapter = new TrunksAiAdapter(trunksService as any, routesService as any, registry as any);
  });

  describe('list_trunks (D-15)', () => {
    it('returns the calling tenant\'s trunks and does not write', async () => {
      const result = await getTool('list_trunks').handler({}, TENANT_A);
      expect(trunksService.findAll).toHaveBeenCalledWith(TENANT_A);
      expect(trunksService.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        trunks: [{ id: 't_mtt_100', name: 'MTT', host: 'sip.mtt.ru', trunkType: 'auth' }],
      });
    });
  });

  describe('create_trunk (D-18, D-27)', () => {
    it('returns a proposal naming the trunk and provider host and writes nothing', async () => {
      const result = await getTool('create_trunk').handler(
        { name: 'Rostelecom', host: 'sip.rt.ru', trunkType: 'auth' },
        TENANT_A,
      );

      expect(getTool('create_trunk').proposes).toBe(true);
      expect(trunksService.create).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          entityType: 'trunk',
          entityLabel: 'Rostelecom',
          applyPayload: expect.objectContaining({
            tool: 'create_trunk',
            args: expect.objectContaining({ name: 'Rostelecom', host: 'sip.rt.ru' }),
          }),
        }),
      );
      expect(result.summary.join(' ')).toMatch(/Rostelecom/);
      expect(result.summary.join(' ')).toMatch(/sip\.rt\.ru/);
    });
  });

  describe('delete_trunk (D-18, T-15-41)', () => {
    it('is destructive and names the routes that reference the trunk', async () => {
      const tool = getTool('delete_trunk');
      expect(tool.destructive).toBe(true);
      expect(tool.proposes).toBe(true);

      const result = await tool.handler({ trunkId: 't_mtt_100' }, TENANT_A);

      expect(trunksService.remove).not.toHaveBeenCalled();
      expect(routesService.findAll).toHaveBeenCalledWith(TENANT_A);
      expect(result.summary.join(' ')).toMatch(/Inbound sales/);
      expect(result.summary.join(' ')).toMatch(/MTT|t_mtt_100/);
    });

    it('confirming a delete still referenced by a route surfaces the references and does not remove', async () => {
      const proposal = await getTool('delete_trunk').handler({ trunkId: 't_mtt_100' }, TENANT_A);
      const confirm = await confirmTrunkDelete(
        trunksService as any,
        routesService as any,
        String(proposal.applyPayload.args.trunkId),
        TENANT_A,
      );

      expect(confirm.ok).toBe(false);
      expect(confirm.references?.map((row) => row.name)).toContain('Inbound sales');
      expect(trunksService.remove).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with the adapter registry', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('trunk domain skill', () => {
    it('ships two-field frontmatter covering registration versus peering and live-call impact', () => {
      const skillPath = path.join(__dirname, '../../skills/trunks/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: trunks\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/регистрац|registration|auth/i);
      expect(raw).toMatch(/пир|peer|ip/i);
      expect(raw).toMatch(/живые|live|звонк/i);
      expect(raw).toMatch(/list_trunks/);
      expect(raw).toMatch(/чеклист|рецепт/i);
    });
  });
});
