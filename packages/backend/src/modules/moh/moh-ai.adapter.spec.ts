import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { MohAiAdapter } from './moh-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const CLASS_A = {
  name: 'moh_100_sales',
  displayName: 'sales',
  mode: 'playlist',
  sort: 'random',
  user_uid: TENANT_A,
  entries: [
    { name: 'moh_100_sales', position: 0, entry: '/var/lib/asterisk/sounds/krasterisk/hold-a.wav' },
    { name: 'moh_100_sales', position: 1, entry: '/var/lib/asterisk/sounds/krasterisk/hold-b.wav' },
  ],
};

const CLASS_B = {
  name: 'moh_200_other',
  displayName: 'other',
  mode: 'files',
  sort: 'alpha',
  user_uid: TENANT_B,
  entries: [
    { name: 'moh_200_other', position: 0, entry: '/var/lib/asterisk/sounds/krasterisk/secret.wav' },
  ],
};

const QUEUE_A = {
  name: 'q100_100',
  display_name: 'Sales',
  musiconhold: 'moh_100_default',
};

const ROUTE_A = {
  uid: 21,
  name: 'Inbound Sales',
  options: { musiconhold: 'moh_100_default' },
};

describe('MohAiAdapter', () => {
  let mohService: { findAll: jest.Mock; findOne: jest.Mock; create: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let queuesService: { findOne: jest.Mock; update: jest.Mock };
  let routesService: { findOne: jest.Mock; update: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: MohAiAdapter;
  const assigned: Array<{ kind: string; target: string | number; dto: Record<string, unknown>; tenant: number }> = [];

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    assigned.length = 0;
    mohService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...CLASS_A, entries: [...CLASS_A.entries] }];
        if (uid === TENANT_B) return [{ ...CLASS_B, entries: [...CLASS_B.entries] }];
        return [];
      }),
      findOne: jest.fn(async (name: string, uid: number) => {
        if (uid === TENANT_A && name === CLASS_A.name) return { ...CLASS_A, entries: [...CLASS_A.entries] };
        if (uid === TENANT_B && name === CLASS_B.name) return { ...CLASS_B, entries: [...CLASS_B.entries] };
        throw new NotFoundException('MOH class not found');
      }),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    queuesService = {
      findOne: jest.fn(async (name: string, uid: number) => {
        if (uid === TENANT_A && name === QUEUE_A.name) return { ...QUEUE_A };
        throw new NotFoundException(`Queue "${name}" not found`);
      }),
      update: jest.fn(async (name: string, dto: Record<string, unknown>, uid: number) => {
        await queuesService.findOne(name, uid);
        assigned.push({ kind: 'queue', target: name, dto, tenant: uid });
        return { ...QUEUE_A, ...dto, name };
      }),
    };
    routesService = {
      findOne: jest.fn(async (routeUid: number, uid: number) => {
        if (uid === TENANT_A && routeUid === ROUTE_A.uid) return { ...ROUTE_A, options: { ...ROUTE_A.options } };
        throw new NotFoundException(`Route ${routeUid} not found`);
      }),
      update: jest.fn(async (routeUid: number, dto: Record<string, unknown>, uid: number) => {
        await routesService.findOne(routeUid, uid);
        assigned.push({ kind: 'route', target: routeUid, dto, tenant: uid });
        return { ...ROUTE_A, ...dto, uid: routeUid };
      }),
    };
    registry = { register: jest.fn() };
    adapter = new MohAiAdapter(
      mohService as any,
      registry as any,
      queuesService as any,
      routesService as any,
    );
  });

  describe('tool declarations (D-18)', () => {
    it('exposes list, describe and assign', () => {
      expect(adapter.getTools().map((tool) => tool.name)).toEqual([
        'list_moh_classes',
        'describe_moh_class',
        'assign_moh_class',
      ]);
    });

    it('marks assign as proposing and no tool as an upload', () => {
      expect(getTool('assign_moh_class').proposes).toBe(true);
      expect(adapter.getTools().some((tool) => /upload|stream|audio/i.test(tool.name))).toBe(false);
    });
  });

  describe('list_moh_classes (D-15)', () => {
    it('returns tenant hold-music classes with track counts and mode', async () => {
      const result = await getTool('list_moh_classes').handler({}, TENANT_A);

      expect(mohService.create).not.toHaveBeenCalled();
      expect(result.classes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'moh_100_sales',
            mode: 'playlist',
            trackCount: 2,
          }),
        ]),
      );
    });
  });

  describe('describe_moh_class', () => {
    it('returns one class with ordered tracks and no audio content or fetchable paths', async () => {
      const result = await getTool('describe_moh_class').handler({ name: 'moh_100_sales' }, TENANT_A);
      const text = JSON.stringify(result);

      expect(result.name).toBe('moh_100_sales');
      expect(result.tracks).toEqual([
        expect.objectContaining({ position: 0, filename: 'hold-a.wav' }),
        expect.objectContaining({ position: 1, filename: 'hold-b.wav' }),
      ]);
      expect(text).not.toMatch(/\/var\/lib\/asterisk/);
      expect(text).not.toMatch(/sounds\/krasterisk/);
      expect(text).not.toMatch(/audio\/|audioBytes|base64/i);
    });
  });

  describe('assign_moh_class (D-15, D-18)', () => {
    it('returns a proposal naming the target, the current class and the new class', async () => {
      const result = await getTool('assign_moh_class').handler(
        { target_type: 'queue', target: 'q100_100', class_name: 'moh_100_sales' },
        TENANT_A,
      );

      expect(queuesService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'assign_moh_class' }));
      const card = result.summary.join(' ');
      expect(card).toMatch(/Sales|q100_100/);
      expect(card).toMatch(/moh_100_default/);
      expect(card).toMatch(/moh_100_sales/);
    });

    it('refuses a class the tenant does not own and names that class', async () => {
      const result = await getTool('assign_moh_class').handler(
        { target_type: 'queue', target: 'q100_100', class_name: 'moh_200_other' },
        TENANT_A,
      );

      expect(queuesService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toBeUndefined();
      expect(result.refused).toBe(true);
      expect(JSON.stringify(result)).toMatch(/moh_200_other/);
    });

    it('assigns to a route without writing until confirm', async () => {
      const result = await getTool('assign_moh_class').handler(
        { target_type: 'route', target: 21, class_name: 'moh_100_sales' },
        TENANT_A,
      );

      expect(routesService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'assign_moh_class' }));
      expect(result.summary.join(' ')).toMatch(/Inbound Sales/);
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with the adapter registry', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('hold-music domain skill', () => {
    it('covers class meaning, play mode, referrers and no-upload', () => {
      const skillPath = path.join(__dirname, '../../skills/moh/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: moh\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/класс|class/i);
      expect(raw).toMatch(/режим|mode|random|playlist/i);
      expect(raw).toMatch(/очеред|queue|маршрут|route/i);
      expect(raw).toMatch(/не загруж|does not upload|не залива/i);
    });
  });
});
