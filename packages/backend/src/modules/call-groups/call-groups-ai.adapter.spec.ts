import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { CallGroupsAiAdapter } from './call-groups-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const GROUP_A = {
  uid: 11,
  name: 'Sales',
  exten: '600',
  strategy: 'ringall',
  members: [
    { member_type: 'internal' as const, value: '201', position: 0, ring_time: 20 },
    { member_type: 'internal' as const, value: '203', position: 1, ring_time: 20 },
  ],
};

const GROUP_B = {
  uid: 99,
  name: 'Other',
  exten: '800',
  strategy: 'hunt',
  members: [{ member_type: 'internal' as const, value: '500', position: 0, ring_time: 20 }],
};

describe('CallGroupsAiAdapter', () => {
  let callGroupsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let endpointsService: { findAll: jest.Mock };
  let routeReferencesService: { findUsage: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: CallGroupsAiAdapter;
  const updatedRows: Array<{ uid: number; dto: Record<string, unknown>; tenant: number }> = [];

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    updatedRows.length = 0;
    callGroupsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...GROUP_A, members: [...GROUP_A.members] }];
        if (uid === TENANT_B) return [{ ...GROUP_B, members: [...GROUP_B.members] }];
        return [];
      }),
      findOne: jest.fn(async (groupUid: number, uid: number) => {
        if (uid === TENANT_A && groupUid === GROUP_A.uid) {
          return { ...GROUP_A, members: [...GROUP_A.members] };
        }
        if (uid === TENANT_B && groupUid === GROUP_B.uid) {
          return { ...GROUP_B, members: [...GROUP_B.members] };
        }
        throw new NotFoundException(`Call group ${groupUid} not found`);
      }),
      create: jest.fn(),
      update: jest.fn(async (groupUid: number, dto: Record<string, unknown>, uid: number) => {
        await callGroupsService.findOne(groupUid, uid);
        updatedRows.push({ uid: groupUid, dto, tenant: uid });
        return { ...GROUP_A, ...dto, uid: groupUid };
      }),
      remove: jest.fn(),
    };
    endpointsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) {
          return [
            { extension: '201', sipUsername: 'e201_100' },
            { extension: '203', sipUsername: 'e203_100' },
            { extension: '205', sipUsername: 'e205_100' },
          ];
        }
        if (uid === TENANT_B) return [{ extension: '500', sipUsername: 'e500_200' }];
        return [];
      }),
    };
    routeReferencesService = {
      findUsage: jest.fn(async () => ({
        references: [
          { host: 'route', routeName: 'Inbound Sales', routeUid: 21 },
          { host: 'ivr', ivrName: 'Main menu', ivrUid: 7, menuDigit: '2' },
        ],
      })),
    };
    registry = { register: jest.fn() };
    adapter = new CallGroupsAiAdapter(
      callGroupsService as any,
      registry as any,
      endpointsService as any,
      routeReferencesService as any,
    );
  });

  describe('tool declarations (D-18)', () => {
    it('exposes list, create, membership update and delete', () => {
      expect(adapter.getTools().map((tool) => tool.name)).toEqual([
        'list_call_groups',
        'create_call_group',
        'update_call_group_members',
        'delete_call_group',
      ]);
    });

    it('marks every mutating tool as proposing and delete as destructive', () => {
      expect(getTool('create_call_group').proposes).toBe(true);
      expect(getTool('update_call_group_members').proposes).toBe(true);
      expect(getTool('delete_call_group').proposes).toBe(true);
      expect(getTool('delete_call_group').destructive).toBe(true);
    });
  });

  describe('list_call_groups (D-15)', () => {
    it('returns the tenant call groups with members and ring strategy', async () => {
      const result = await getTool('list_call_groups').handler({}, TENANT_A);

      expect(callGroupsService.create).not.toHaveBeenCalled();
      expect(callGroupsService.update).not.toHaveBeenCalled();
      expect(callGroupsService.remove).not.toHaveBeenCalled();
      expect(result.groups).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            uid: 11,
            name: 'Sales',
            exten: '600',
            strategy: 'ringall',
            members: expect.arrayContaining([
              expect.objectContaining({ value: '201' }),
              expect.objectContaining({ value: '203' }),
            ]),
          }),
        ]),
      );
    });
  });

  describe('update_call_group_members (D-15, D-18)', () => {
    it('returns a proposal whose summary names members added and removed', async () => {
      const result = await getTool('update_call_group_members').handler(
        {
          uid: 11,
          members: [
            { member_type: 'internal', value: '201', position: 0 },
            { member_type: 'internal', value: '205', position: 1 },
          ],
        },
        TENANT_A,
      );

      expect(callGroupsService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(
        expect.objectContaining({ tool: 'update_call_group_members' }),
      );
      const card = result.summary.join(' ');
      expect(card).toMatch(/205/);
      expect(card).toMatch(/203/);
      expect(card).toMatch(/add|добав/i);
      expect(card).toMatch(/remov|удал/i);
    });

    it('refuses a membership proposal naming a subscriber that does not exist for the tenant', async () => {
      const result = await getTool('update_call_group_members').handler(
        {
          uid: 11,
          members: [
            { member_type: 'internal', value: '201', position: 0 },
            { member_type: 'internal', value: '999', position: 1 },
          ],
        },
        TENANT_A,
      );

      expect(callGroupsService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toBeUndefined();
      expect(result.refused).toBe(true);
      expect(JSON.stringify(result)).toMatch(/999/);
    });

    it('confirming a membership proposal updates exactly one group for the calling tenant', async () => {
      const proposal = await getTool('update_call_group_members').handler(
        {
          uid: 11,
          members: [
            { member_type: 'internal', value: '201', position: 0 },
            { member_type: 'internal', value: '205', position: 1 },
          ],
        },
        TENANT_A,
      );
      expect(updatedRows).toHaveLength(0);

      const { uid, ...rest } = proposal.applyPayload.args;
      await callGroupsService.update(Number(uid), rest, TENANT_A);

      expect(updatedRows).toHaveLength(1);
      expect(updatedRows[0].uid).toBe(11);
      expect(updatedRows[0].tenant).toBe(TENANT_A);
    });
  });

  describe('delete_call_group', () => {
    it('is destructive and names the routes and menus that ring the group', async () => {
      const result = await getTool('delete_call_group').handler({ uid: 11 }, TENANT_A);

      expect(callGroupsService.remove).not.toHaveBeenCalled();
      expect(routeReferencesService.findUsage).toHaveBeenCalled();
      const card = result.summary.join(' ');
      expect(card).toMatch(/Inbound Sales/);
      expect(card).toMatch(/Main menu/);
    });
  });

  describe('create_call_group', () => {
    it('returns a pending proposal and does not write', async () => {
      const result = await getTool('create_call_group').handler(
        {
          name: 'Support',
          exten: '610',
          strategy: 'hunt',
          members: [{ member_type: 'internal', value: '201', position: 0 }],
        },
        TENANT_A,
      );

      expect(callGroupsService.create).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'create_call_group' }));
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with the adapter registry', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('call-groups domain skill', () => {
    it('covers ring strategies, group vs queue and numbering', () => {
      const skillPath = path.join(__dirname, '../../skills/call-groups/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: call-groups\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/ringall|hunt|memoryhunt|random/i);
      expect(raw).toMatch(/очеред|queue/i);
      expect(raw).toMatch(/номер|exten|нумерац/i);
    });
  });
});
