import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';
import { ConferenceRoom } from './models/conference-room.model';
import { CONFERENCE_SCHEMA_STATEMENTS } from './setup-conferences-schema';

const VPBX = 42;
const ROOM_UID = 77;
const ROOM_NUMBER = '6007';

function roomRow(overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = {
    uid: ROOM_UID,
    number: ROOM_NUMBER,
    name: 'Sales conf',
    user_uid: VPBX,
    kind: 'permanent',
    entry_strictness: 'token_name',
    pin: null,
    wait_marked: 0,
    end_marked: 0,
    record_mode: 'off',
    notify_recording: 1,
    invite_external_scope: 'owner',
    tariff_max_participants: null,
    musiconhold: null,
    announce_join_leave: 0,
    created_by: null,
    ...overrides,
  };
  const row = {
    ...data,
    toJSON: () => ({ ...data }),
    update: jest.fn().mockImplementation(async (payload: Record<string, unknown>) => {
      Object.assign(data, payload);
      Object.assign(row, payload);
      return row;
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  return row;
}

describe('ConferenceRoomsService CRUD (16-02)', () => {
  let roomModel: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let sequelize: { transaction: jest.Mock };
  let transaction: { commit: jest.Mock; rollback: jest.Mock };
  let dialplanApplyService: jest.Mocked<
    Pick<DialplanApplyService, 'applyCategories' | 'deleteCategories'>
  >;
  let stateService: ConferenceStateService;
  let service: ConferenceRoomsService;

  beforeEach(() => {
    transaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    roomModel = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    sequelize = {
      transaction: jest.fn().mockResolvedValue(transaction),
    };
    dialplanApplyService = {
      applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 4 }),
      deleteCategories: jest.fn().mockResolvedValue({ success: true }),
    };
    stateService = new ConferenceStateService();
    service = new ConferenceRoomsService(
      roomModel as any,
      sequelize as any,
      dialplanApplyService as unknown as DialplanApplyService,
      stateService,
    );
  });

  describe('UpdateConferenceRoomDto', () => {
    it('does not declare user_uid or vpbx_user_uid', () => {
      const dtoPath = path.resolve(__dirname, 'dto/update-conference-room.dto.ts');
      const src = fs.readFileSync(dtoPath, 'utf8');
      expect(src).not.toMatch(/\buser_uid\b/);
      expect(src).not.toMatch(/\bvpbx_user_uid\b/);
      const { UpdateConferenceRoomDto } = require('./dto/update-conference-room.dto');
      expect(Object.prototype.hasOwnProperty.call(new UpdateConferenceRoomDto(), 'user_uid')).toBe(
        false,
      );
      expect(
        Object.prototype.hasOwnProperty.call(new UpdateConferenceRoomDto(), 'vpbx_user_uid'),
      ).toBe(false);
    });
  });

  describe('update', () => {
    it('saves changes for the tenant and applies dialplan once', async () => {
      const room = roomRow();
      roomModel.findOne.mockResolvedValue(room);

      const result = await service.update(ROOM_UID, { name: 'Renamed' }, VPBX);

      expect(room.update).toHaveBeenCalledTimes(1);
      expect(room.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Renamed' }),
        { transaction },
      );
      expect(transaction.commit).toHaveBeenCalled();
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
        'krasterisk/conferences/conf_42.conf',
        [expect.objectContaining({ name: 'krsk-conf-77' })],
        { reload: true },
      );
      expect(result.name).toBe('Renamed');
    });

    it('throws NotFoundException for a foreign tenant and never updates', async () => {
      roomModel.findOne.mockResolvedValue(null);
      const room = roomRow();

      await expect(service.update(ROOM_UID, { name: 'Hijack' }, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(room.update).not.toHaveBeenCalled();
      expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    });

    it('ignores a tenant field in the body and keeps user_uid unchanged', async () => {
      const room = roomRow({ user_uid: VPBX });
      roomModel.findOne.mockResolvedValue(room);

      await service.update(
        ROOM_UID,
        { name: 'Keep tenant', user_uid: 99, vpbx_user_uid: 99 } as any,
        VPBX,
      );

      expect(room.update).toHaveBeenCalledTimes(1);
      const payload = room.update.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.user_uid).toBeUndefined();
      expect(payload.vpbx_user_uid).toBeUndefined();
      expect(room.user_uid).toBe(VPBX);
    });

    it('maps UniqueConstraintError on number change to CONFERENCE_NUMBER_TAKEN', async () => {
      const room = roomRow();
      roomModel.findOne.mockResolvedValue(room);
      room.update.mockRejectedValueOnce(
        new UniqueConstraintError({ errors: [] } as ConstructorParameters<
          typeof UniqueConstraintError
        >[0]),
      );

      try {
        await service.update(ROOM_UID, { number: '6008' }, VPBX);
        throw new Error('expected CONFERENCE_NUMBER_TAKEN');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
        expect((err as HttpException).getResponse()).toMatchObject({
          code: 'CONFERENCE_NUMBER_TAKEN',
        });
      }
      expect(transaction.rollback).toHaveBeenCalled();
      expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    });

    it('returns the updated room when applyCategories fails after commit', async () => {
      const room = roomRow();
      roomModel.findOne.mockResolvedValue(room);
      dialplanApplyService.applyCategories.mockRejectedValueOnce(new Error('AMI down'));

      const result = await service.update(ROOM_UID, { name: 'Still saved' }, VPBX);

      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(result.name).toBe('Still saved');
    });

    it('applies the room category and rebuilt mask-index in one call', async () => {
      const room = roomRow();
      roomModel.findOne.mockResolvedValue(room);
      roomModel.findAll.mockResolvedValue([room]);

      await service.update(ROOM_UID, { name: 'Renamed' }, VPBX);

      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
      const [, categories] = dialplanApplyService.applyCategories.mock.calls[0];
      expect(categories).toHaveLength(2);
      expect(categories.map((c: { name: string }) => c.name)).toEqual([
        `krsk-conf-${ROOM_UID}`,
        `krsk-conf-mask-${VPBX}`,
      ]);
    });
  });

  describe('create', () => {
    it('applies the room category and rebuilt mask-index in one call', async () => {
      const created = roomRow();
      roomModel.create.mockResolvedValue(created);
      roomModel.findAll.mockResolvedValue([created]);

      await service.create({ number: ROOM_NUMBER, name: 'Sales conf' } as any, VPBX);

      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
      const [, categories] = dialplanApplyService.applyCategories.mock.calls[0];
      expect(categories).toHaveLength(2);
      expect(categories.map((c: { name: string }) => c.name)).toEqual([
        `krsk-conf-${ROOM_UID}`,
        `krsk-conf-mask-${VPBX}`,
      ]);
    });
  });

  describe('remove', () => {
    it('deletes the row and its krsk-conf-{uid} category once', async () => {
      const room = roomRow({ uid: ROOM_UID });
      roomModel.findOne.mockResolvedValue(room);

      await service.remove(ROOM_UID, VPBX);

      expect(room.destroy).toHaveBeenCalledWith({ transaction });
      expect(transaction.commit).toHaveBeenCalled();
      expect(dialplanApplyService.deleteCategories).toHaveBeenCalledTimes(1);
      expect(dialplanApplyService.deleteCategories).toHaveBeenCalledWith(
        'krasterisk/conferences/conf_42.conf',
        ['krsk-conf-77'],
        { reload: true },
      );
    });

    it('throws NotFoundException for a foreign tenant and never deletes categories', async () => {
      roomModel.findOne.mockResolvedValue(null);

      await expect(service.remove(ROOM_UID, 99)).rejects.toBeInstanceOf(NotFoundException);
      expect(dialplanApplyService.deleteCategories).not.toHaveBeenCalled();
    });

    it('keeps the DB delete when deleteCategories fails after commit', async () => {
      const room = roomRow();
      roomModel.findOne.mockResolvedValue(room);
      dialplanApplyService.deleteCategories.mockRejectedValueOnce(new Error('AMI down'));

      const result = await service.remove(ROOM_UID, VPBX);

      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('rebuilds mask-index without the deleted room number', async () => {
      const room = roomRow({ uid: ROOM_UID });
      const leftover = roomRow({ uid: 81, number: '6008' });
      roomModel.findOne.mockResolvedValue(room);
      roomModel.findAll.mockResolvedValue([leftover]);

      await service.remove(ROOM_UID, VPBX);

      expect(dialplanApplyService.deleteCategories).toHaveBeenCalledTimes(1);
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
      const [, categories] = dialplanApplyService.applyCategories.mock.calls[0];
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe(`krsk-conf-mask-${VPBX}`);
      const joined = categories[0].lines.join('\n');
      expect(joined).not.toMatch(/exten => 6007,/);
      expect(joined).toMatch(/exten => 6008,/);
    });
  });

  describe('assertLiveRoomAccess (D-17)', () => {
    let modelSequelize: Sequelize;
    let loggerService: { logAction: jest.Mock };

    beforeAll(() => {
      modelSequelize = new Sequelize({
        dialect: 'mysql',
        host: '127.0.0.1',
        username: 'x',
        password: 'x',
        database: 'x',
        logging: false,
        models: [ConferenceRoom],
      });
    });

    afterAll(async () => {
      await modelSequelize.close();
    });

    function roomFromAttributes(overrides: Record<string, unknown> = {}) {
      const attrs = ConferenceRoom.getAttributes();
      expect(Object.keys(attrs)).toContain('created_by');
      const roomsSql = CONFERENCE_SCHEMA_STATEMENTS.find((sql) =>
        sql.includes('`conference_rooms`'),
      );
      expect(roomsSql).toBeDefined();
      expect(roomsSql).toContain('`created_by`');

      const defaults: Record<string, unknown> = {
        uid: ROOM_UID,
        user_uid: VPBX,
        number: ROOM_NUMBER,
        name: 'Sales conf',
        kind: 'permanent',
        created_by: null,
      };
      const data: Record<string, unknown> = {};
      for (const key of Object.keys(attrs)) {
        data[key] = key in overrides ? overrides[key] : (defaults[key] ?? null);
      }
      return {
        ...data,
        toJSON: () => ({ ...data }),
      };
    }

    beforeEach(() => {
      loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
      service = new ConferenceRoomsService(
        roomModel as any,
        sequelize as any,
        dialplanApplyService as unknown as DialplanApplyService,
        stateService,
        loggerService as any,
      );
    });

    it('writes logAction once when created_by is another portal user', async () => {
      roomModel.findOne.mockResolvedValue(roomFromAttributes({ created_by: 7 }));

      await service.assertLiveRoomAccess(ROOM_UID, { sub: 5, vpbx_user_uid: VPBX });

      expect(loggerService.logAction).toHaveBeenCalledTimes(1);
      const args = loggerService.logAction.mock.calls[0];
      expect(args).toEqual(expect.arrayContaining([5, ROOM_UID]));
      expect(args[0]).toBe(5);
      expect(args).toContain(ROOM_UID);
    });

    it('does not write audit when created_by equals the visitor sub', async () => {
      roomModel.findOne.mockResolvedValue(roomFromAttributes({ created_by: 7 }));

      await service.assertLiveRoomAccess(ROOM_UID, { sub: 7, vpbx_user_uid: VPBX });

      expect(loggerService.logAction).not.toHaveBeenCalled();
    });

    it('audits another admin entering an operator ephemeral room, not the operator', async () => {
      roomModel.findOne.mockResolvedValue(
        roomFromAttributes({ kind: 'ephemeral', created_by: 7 }),
      );

      await service.assertLiveRoomAccess(ROOM_UID, { sub: 5, vpbx_user_uid: VPBX });
      expect(loggerService.logAction).toHaveBeenCalledTimes(1);

      loggerService.logAction.mockClear();
      await service.assertLiveRoomAccess(ROOM_UID, { sub: 7, vpbx_user_uid: VPBX });
      expect(loggerService.logAction).not.toHaveBeenCalled();
    });

    it('does not write audit when created_by is null', async () => {
      roomModel.findOne.mockResolvedValue(roomFromAttributes({ created_by: null }));

      await service.assertLiveRoomAccess(ROOM_UID, { sub: 5, vpbx_user_uid: VPBX });

      expect(loggerService.logAction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a foreign tenant and never audits', async () => {
      roomModel.findOne.mockResolvedValue(null);

      await expect(
        service.assertLiveRoomAccess(ROOM_UID, { sub: 5, vpbx_user_uid: 99 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(loggerService.logAction).not.toHaveBeenCalled();
    });
  });

  describe('live-room wiring (D-03 / D-17)', () => {
    it('SSE endpoint calls assertLiveRoomAccess before forming the stream', () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, 'conference-sse.controller.ts'),
        'utf8',
      );
      const body = src.slice(src.indexOf('events('));
      expect(body).toContain('assertLiveRoomAccess');
      expect(body.indexOf('assertLiveRoomAccess')).toBeLessThan(body.indexOf('startWith'));
      expect(body).toContain('startWith');
      expect(body).toMatch(/heartbeat/);
    });

    it('addToConference takes the room name from ensureRoomForCall, not uniqueid', () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, '../callcenter/callcenter.service.ts'),
        'utf8',
      );
      const start = src.indexOf('async addToConference');
      const end = src.indexOf('async resetZombieCall');
      const method = src.slice(start, end);
      expect(method).toMatch(
        /ensureRoomForCall\(\s*uniqueid\s*,\s*userUid\s*,\s*userId,?\s*\)/,
      );
      expect(method).not.toMatch(/uniqueid\.replace/);
      expect(method).toMatch(
        /addToConference\(\s*uniqueid:\s*string,\s*target:\s*string,\s*userUid:\s*number,\s*userId:\s*number\s*\)/,
      );
    });
  });
});
