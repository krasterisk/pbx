import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { TimeGroupsAiAdapter } from './time-groups-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const OFFICE_HOURS = {
  time_start: '09:00',
  time_end: '18:00',
  days_of_week: 'mon-fri',
  days_of_month: '*',
  months: '*',
};

const SCHEDULE_A = {
  uid: 11,
  name: 'office-hours',
  comment: 'Weekday office',
  intervals: [OFFICE_HOURS],
  user_uid: TENANT_A,
};

const SCHEDULE_B = {
  uid: 22,
  name: 'night-shift',
  comment: 'Tenant B nights',
  intervals: [
    {
      time_start: '22:00',
      time_end: '06:00',
      days_of_week: '*',
      days_of_month: '*',
      months: '*',
    },
  ],
  user_uid: TENANT_B,
};

const CREATE_ARGS = {
  name: 'Рабочие',
  comment: 'Пн–Пт и суббота',
  intervals: [
    { time_start: '08:00', time_end: '17:00', days_of_week: 'mon-fri' },
    { time_start: '09:00', time_end: '15:00', days_of_week: 'sat' },
  ],
};

function getTool(adapter: TimeGroupsAiAdapter, name: string) {
  const tool = adapter.getTools().find((entry) => entry.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

describe('TimeGroupsAiAdapter mutations', () => {
  let timeGroupsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let tenantSettings: { getAll: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: TimeGroupsAiAdapter;

  beforeEach(() => {
    timeGroupsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...SCHEDULE_A, intervals: [...SCHEDULE_A.intervals] }];
        if (uid === TENANT_B) return [{ ...SCHEDULE_B, intervals: [...SCHEDULE_B.intervals] }];
        return [];
      }),
      findOne: jest.fn(async (id: number, uid: number) => {
        if (uid === TENANT_A && id === SCHEDULE_A.uid) {
          return { ...SCHEDULE_A, intervals: [...SCHEDULE_A.intervals] };
        }
        if (uid === TENANT_B && id === SCHEDULE_B.uid) {
          return { ...SCHEDULE_B, intervals: [...SCHEDULE_B.intervals] };
        }
        throw new NotFoundException('Time group not found');
      }),
      create: jest.fn(async (data: { name: string }, uid: number) => ({
        uid: 77,
        name: data.name,
        user_uid: uid,
      })),
      update: jest.fn(async (id: number, data: Record<string, unknown>, uid: number) => {
        await timeGroupsService.findOne(id, uid);
        return { uid: id, ...data, user_uid: uid };
      }),
      remove: jest.fn(),
    };
    tenantSettings = {
      getAll: jest.fn(async () => ({ timezone: 'Europe/Moscow' })),
    };
    registry = { register: jest.fn() };
    adapter = new TimeGroupsAiAdapter(timeGroupsService as any, registry as any, tenantSettings as any);
  });

  describe('tool declarations', () => {
    it('exposes list, evaluate, create and update', () => {
      expect(adapter.getTools().map((tool) => tool.name)).toEqual([
        'list_time_groups',
        'evaluate_time_group',
        'create_time_group',
        'update_time_group',
      ]);
    });

    it('marks create and update as proposing', () => {
      expect(getTool(adapter, 'create_time_group').proposes).toBe(true);
      expect(getTool(adapter, 'update_time_group').proposes).toBe(true);
      expect(getTool(adapter, 'list_time_groups').proposes).toBeFalsy();
    });
  });

  describe('create_time_group', () => {
    it('returns a pending proposal and does not write', async () => {
      const result = await getTool(adapter, 'create_time_group').handler(CREATE_ARGS, TENANT_A);

      expect(timeGroupsService.create).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'create_time_group' }));
      expect(result.applyPayload.args.intervals).toEqual([
        expect.objectContaining({
          time_start: '08:00',
          time_end: '17:00',
          days_of_week: 'mon-fri',
          days_of_month: '*',
          months: '*',
        }),
        expect.objectContaining({
          time_start: '09:00',
          time_end: '15:00',
          days_of_week: 'sat',
        }),
      ]);
    });

    it('lists name and readable intervals on the card', async () => {
      const result = await getTool(adapter, 'create_time_group').handler(CREATE_ARGS, TENANT_A);
      const card = result.summary.join('\n');
      expect(card).toMatch(/Рабочие/);
      expect(card).toMatch(/08:00/);
      expect(card).toMatch(/17:00/);
      expect(card).toMatch(/mon-fri|пн|будн/i);
      expect(card).toMatch(/09:00/);
      expect(card).toMatch(/sat|сб/i);
    });

    it('refuses an empty intervals array', async () => {
      await expect(
        getTool(adapter, 'create_time_group').handler({ name: 'Пустой', intervals: [] }, TENANT_A),
      ).rejects.toThrow(/ARGS_INVALID|intervals/i);
      expect(timeGroupsService.create).not.toHaveBeenCalled();
    });

    it('refuses an invalid clock time', async () => {
      await expect(
        getTool(adapter, 'create_time_group').handler(
          {
            name: 'Сломанный',
            intervals: [{ time_start: '25:00', time_end: '18:00', days_of_week: 'mon-fri' }],
          },
          TENANT_A,
        ),
      ).rejects.toThrow(/ARGS_INVALID|time_start/i);
      expect(timeGroupsService.create).not.toHaveBeenCalled();
    });

    it('refuses a duplicate name in the same tenant', async () => {
      const result = await getTool(adapter, 'create_time_group').handler(
        { name: 'Office-Hours', intervals: [OFFICE_HOURS] },
        TENANT_A,
      );
      expect(result.refused).toBe(true);
      expect(String(result.message)).toMatch(/office-hours/i);
      expect(timeGroupsService.create).not.toHaveBeenCalled();
    });

    it('ignores a forged tenant key in arguments', async () => {
      await expect(
        getTool(adapter, 'create_time_group').handler(
          { ...CREATE_ARGS, vpbxUserUid: TENANT_B, user_uid: TENANT_B },
          TENANT_A,
        ),
      ).rejects.toThrow(/TENANT_ARG_FORBIDDEN/);
      expect(timeGroupsService.create).not.toHaveBeenCalled();
    });

    it('apply writes with the dispatch tenant and returns the created uid', async () => {
      const tool = getTool(adapter, 'create_time_group');
      const proposed = await tool.handler(CREATE_ARGS, TENANT_A);
      const created = await tool.mutation!.apply(proposed.applyPayload.args, {
        vpbxUserUid: TENANT_A,
        userUid: 1,
        role: 1,
        isAdmin: true,
      });

      expect(timeGroupsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Рабочие',
          intervals: expect.arrayContaining([
            expect.objectContaining({ time_start: '08:00', days_of_week: 'mon-fri' }),
          ]),
        }),
        TENANT_A,
      );
      expect(created).toEqual(expect.objectContaining({ uid: 77, name: 'Рабочие' }));
    });
  });

  describe('update_time_group', () => {
    it('returns a pending proposal for an owned calendar', async () => {
      const result = await getTool(adapter, 'update_time_group').handler(
        {
          uid: 11,
          intervals: [{ time_start: '08:00', time_end: '17:00', days_of_week: 'mon-fri' }],
        },
        TENANT_A,
      );

      expect(timeGroupsService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'update_time_group' }));
      expect(result.applyPayload.args.uid).toBe(11);
      expect(result.summary.join('\n')).toMatch(/08:00/);
    });

    it('refuses another tenant calendar', async () => {
      await expect(
        getTool(adapter, 'update_time_group').handler(
          { uid: 22, name: 'Stolen' },
          TENANT_A,
        ),
      ).rejects.toThrow(/not found/i);
      expect(timeGroupsService.update).not.toHaveBeenCalled();
    });

    it('apply updates only the owned uid', async () => {
      const tool = getTool(adapter, 'update_time_group');
      const proposed = await tool.handler({ uid: 11, name: 'Будни' }, TENANT_A);
      await tool.mutation!.apply(proposed.applyPayload.args, {
        vpbxUserUid: TENANT_A,
        userUid: 1,
        role: 1,
        isAdmin: true,
      });

      expect(timeGroupsService.update).toHaveBeenCalledWith(
        11,
        expect.objectContaining({ name: 'Будни' }),
        TENANT_A,
      );
    });
  });

  describe('domain skill', () => {
    it('covers creation, intervals and hanging the calendar on a route', () => {
      const skillPath = path.join(__dirname, '../../skills/time-groups/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: time-groups\r?\ndescription: .+/);
      expect(raw).toMatch(/create_time_group/);
      expect(raw).toMatch(/list_time_groups/);
      expect(raw).toMatch(/time_group_uid|condition/i);
      expect(raw).not.toMatch(/только для чтения|домен только для чтения/i);
    });
  });
});
