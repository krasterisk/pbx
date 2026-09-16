import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { firstValueFrom } from 'rxjs';
import { Sequelize } from 'sequelize-typescript';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceRoomsController } from './conference-rooms.controller';
import { ConferenceSseController } from './conference-sse.controller';
import { ConferenceStateService } from './conference-state.service';
import { ConferenceRoom } from './models/conference-room.model';
import { CreateConferenceRoomDto } from './dto/create-conference-room.dto';
import {
  CONFERENCE_SCHEMA_STATEMENTS,
} from './setup-conferences-schema';
import {
  CONFBRIDGE_BRIDGE_PROFILE,
  generateConferenceDialplan,
} from './conference-dialplan.util';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import type { DialplanApplyService } from '../ami/dialplan-apply.service';

const VPBX = 42;
const ROOM_UID = 77;
const ROOM_NUMBER = '6007';
const CREATOR_SUB = 7;

function roomRow(overrides: Record<string, unknown> = {}) {
  const data = {
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
  return {
    ...data,
    toJSON: () => ({ ...data }),
  };
}

function emptyRoomInput() {
  return { uid: ROOM_UID, number: ROOM_NUMBER, name: 'Sales conf' };
}

describe('conference spine (16-01)', () => {
  describe('normalizeTarget conference', () => {
    it('builds a tenant-scoped ConfBridge name', () => {
      expect(normalizeTarget('conference', { source: 'fixed', value: '6007' }, 42)).toBe(
        'conf6007_42',
      );
    });

    it('passes through an already-scoped name without a second prefix', () => {
      expect(
        normalizeTarget('conference', { source: 'fixed', value: 'conf6007_42' }, 42),
      ).toBe('conf6007_42');
    });
  });

  describe('TargetKind exhaustiveness', () => {
    it('keeps conference in the union and the never-default guard', () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../shared/utils/dialplan-target.util.ts'),
        'utf8',
      );
      expect(src).toMatch(/TargetKind[\s\S]*'conference'/);
      expect(src).toContain('const _never: never = kind');
    });
  });

  describe('generateConferenceDialplan', () => {
    it('names the category by room uid and places template before ConfBridge', () => {
      const category = generateConferenceDialplan(emptyRoomInput(), VPBX);
      expect(category.name).toBe('krsk-conf-77');
      const templateIdx = category.lines.findIndex((line) =>
        line.includes('CONFBRIDGE(bridge,template)=krsk_conf_sfu'),
      );
      const appIdx = category.lines.findIndex((line) => /ConfBridge\(/.test(line));
      expect(templateIdx).toBeGreaterThanOrEqual(0);
      expect(appIdx).toBeGreaterThan(templateIdx);
      expect(category.lines[appIdx]).toContain('conf6007_42');
      expect(category.lines[appIdx]).toContain(CONFBRIDGE_BRIDGE_PROFILE);
    });

    it('never emits video_mode and never emits empty CONFBRIDGE assignments', () => {
      const category = generateConferenceDialplan(emptyRoomInput(), VPBX);
      expect(category.lines.some((line) => line.includes('video_mode'))).toBe(false);
      const confSets = category.lines.filter((line) => line.includes('Set(CONFBRIDGE('));
      expect(confSets.every((line) => !/=\s*$/.test(line) && !/=''\s*$/.test(line))).toBe(
        true,
      );
    });

    it('emits no empty Set(CONFBRIDGE) values when the room has no filled options', () => {
      const category = generateConferenceDialplan(emptyRoomInput(), VPBX);
      const extraSets = category.lines.filter(
        (line) =>
          line.includes('Set(CONFBRIDGE(') && !line.includes('CONFBRIDGE(bridge,template)'),
      );
      expect(extraSets).toHaveLength(0);
      expect(category.lines.some((line) => /Hangup\(\)/.test(line))).toBe(true);
    });

    it('places template before a matching tenant bridge override (D-02 adjacency)', () => {
      const category = generateConferenceDialplan(
        { ...emptyRoomInput(), tariff_max_participants: 12 },
        VPBX,
      );
      const templateIdx = category.lines.findIndex((line) =>
        line.includes('CONFBRIDGE(bridge,template)=krsk_conf_sfu'),
      );
      const overrideIdx = category.lines.findIndex((line) =>
        line.includes('Set(CONFBRIDGE(bridge,max_members)='),
      );
      expect(templateIdx).toBeGreaterThanOrEqual(0);
      expect(overrideIdx).toBeGreaterThan(templateIdx);
    });

    it('is byte-stable for the same room settings', () => {
      const a = generateConferenceDialplan(
        { ...emptyRoomInput(), wait_marked: 1, musiconhold: 'default' },
        VPBX,
      );
      const b = generateConferenceDialplan(
        { ...emptyRoomInput(), wait_marked: 1, musiconhold: 'default' },
        VPBX,
      );
      expect(a.lines).toEqual(b.lines);
    });
  });

  describe('CONFERENCE_SCHEMA_STATEMENTS', () => {
    it('is five idempotent CREATE TABLE statements with tenant only on rooms', () => {
      expect(CONFERENCE_SCHEMA_STATEMENTS).toHaveLength(5);
      for (const statement of CONFERENCE_SCHEMA_STATEMENTS) {
        expect(statement.trimStart().startsWith('CREATE TABLE IF NOT EXISTS')).toBe(true);
        expect(statement).not.toMatch(/DROP/i);
      }
      const withTenant = CONFERENCE_SCHEMA_STATEMENTS.filter((s) =>
        s.includes('vpbx_user_uid'),
      );
      expect(withTenant).toHaveLength(1);
      expect(withTenant[0]).toMatch(/conference_rooms/);
      expect(withTenant[0]).toContain('created_by');
    });

    it('exposes created_by on the Sequelize model', () => {
      const sequelize = new Sequelize({
        dialect: 'mysql',
        host: '127.0.0.1',
        username: 'x',
        password: 'x',
        database: 'x',
        logging: false,
        models: [ConferenceRoom],
      });
      const attrs = ConferenceRoom.getAttributes();
      expect(attrs).toHaveProperty('created_by');
      void sequelize.close();
    });
  });

  describe('CreateConferenceRoomDto', () => {
    async function errorsFor(overrides: Record<string, unknown>) {
      const dto = plainToInstance(CreateConferenceRoomDto, {
        number: '6007',
        name: 'Sales conf',
        ...overrides,
      });
      return validate(dto);
    }

    it('accepts 1- and 32-digit ASCII numbers and rejects 33', async () => {
      expect((await errorsFor({ number: '6' })).filter((e) => e.property === 'number')).toHaveLength(
        0,
      );
      expect(
        (await errorsFor({ number: '1'.repeat(32) })).filter((e) => e.property === 'number'),
      ).toHaveLength(0);
      expect(
        (await errorsFor({ number: '1'.repeat(33) })).some((e) => e.property === 'number'),
      ).toBe(true);
    });

    it('rejects empty or missing number', async () => {
      expect((await errorsFor({ number: '' })).some((e) => e.property === 'number')).toBe(true);
      const missing = plainToInstance(CreateConferenceRoomDto, { name: 'Sales conf' });
      expect((await validate(missing)).some((e) => e.property === 'number')).toBe(true);
    });

    it('rejects non-ASCII digits so the tenant name stays single-byte', async () => {
      expect((await errorsFor({ number: '٦007' })).some((e) => e.property === 'number')).toBe(
        true,
      );
      expect((await errorsFor({ number: '6０07' })).some((e) => e.property === 'number')).toBe(
        true,
      );
    });
  });

  describe('ConferenceRoomsService', () => {
    let roomModel: {
      findAll: jest.Mock;
      findOne: jest.Mock;
      create: jest.Mock;
    };
    let sequelize: { transaction: jest.Mock };
    let transaction: { commit: jest.Mock; rollback: jest.Mock };
    let dialplanApplyService: jest.Mocked<
      Pick<DialplanApplyService, 'applyCategories'>
    >;
    let stateService: ConferenceStateService;
    let service: ConferenceRoomsService;

    beforeEach(() => {
      transaction = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      };
      roomModel = {
        findAll: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        create: jest.fn(),
      };
      sequelize = {
        transaction: jest.fn().mockResolvedValue(transaction),
      };
      dialplanApplyService = {
        applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 4 }),
      };
      stateService = new ConferenceStateService();
      service = new ConferenceRoomsService(
        roomModel as any,
        sequelize as any,
        dialplanApplyService as unknown as DialplanApplyService,
        stateService,
      );
    });

    it('persists created_by from the third argument and ignores it on the DTO', async () => {
      const created = roomRow({ created_by: CREATOR_SUB });
      roomModel.create.mockImplementation(async (payload: Record<string, unknown>) =>
        roomRow({ ...payload, uid: ROOM_UID, created_by: payload.created_by }),
      );
      roomModel.findOne.mockResolvedValue(created);

      const result = await service.create(
        { number: ROOM_NUMBER, name: 'Sales conf', created_by: 999 } as any,
        VPBX,
        CREATOR_SUB,
      );

      expect(roomModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          number: ROOM_NUMBER,
          user_uid: VPBX,
          created_by: CREATOR_SUB,
        }),
        { transaction },
      );
      const payload = roomModel.create.mock.calls[0][0];
      expect(payload.created_by).toBe(CREATOR_SUB);
      expect(payload.created_by).not.toBe(999);
      expect(result.created_by).toBe(CREATOR_SUB);
    });

    it('stores null created_by when the third argument is omitted', async () => {
      roomModel.create.mockImplementation(async (payload: Record<string, unknown>) =>
        roomRow({ ...payload, uid: ROOM_UID }),
      );
      roomModel.findOne.mockResolvedValue(roomRow({ created_by: null }));

      const result = await service.create({ number: ROOM_NUMBER, name: 'Sales conf' } as any, VPBX);

      expect(roomModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ created_by: null }),
        { transaction },
      );
      expect(result.created_by).toBeNull();
    });

    it('applies the room category once and still returns the row when apply fails', async () => {
      roomModel.create.mockResolvedValue(roomRow());
      roomModel.findOne.mockResolvedValue(roomRow());

      const ok = await service.create({ number: ROOM_NUMBER, name: 'Sales conf' } as any, VPBX);
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
      expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
        'krasterisk/conferences/conf_42.conf',
        expect.arrayContaining([expect.objectContaining({ name: 'krsk-conf-77' })]),
        { reload: true },
      );
      expect(ok.uid).toBe(ROOM_UID);

      dialplanApplyService.applyCategories.mockRejectedValueOnce(new Error('AMI down'));
      roomModel.create.mockResolvedValue(roomRow({ uid: 78 }));
      roomModel.findOne.mockResolvedValue(roomRow({ uid: 78 }));
      const stillSaved = await service.create(
        { number: '6008', name: 'Other' } as any,
        VPBX,
      );
      expect(stillSaved.uid).toBe(78);
    });

    it('hides a foreign tenant room behind NotFoundException, not Forbidden', async () => {
      roomModel.findOne.mockResolvedValue(null);
      await expect(service.findOne(ROOM_UID, 99)).rejects.toBeInstanceOf(NotFoundException);
      try {
        await service.findOne(ROOM_UID, 99);
        throw new Error('expected NotFoundException');
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err).not.toBeInstanceOf(ForbiddenException);
      }
    });
  });

  describe('ConferenceRoomsController POST /', () => {
    it('passes JWT sub as createdBy, not vpbx_user_uid', async () => {
      const create = jest.fn().mockResolvedValue(roomRow({ created_by: 99 }));
      const controller = new ConferenceRoomsController({ create } as any);
      await controller.create({ number: ROOM_NUMBER, name: 'Sales conf' } as any, {
        user: { sub: 99, vpbx_user_uid: VPBX },
      } as any);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ number: ROOM_NUMBER }),
        VPBX,
        99,
      );
      expect(create.mock.calls[0][2]).toBe(99);
      expect(create.mock.calls[0][2]).not.toBe(VPBX);
      expect(create.mock.calls[0]).toHaveLength(3);
    });
  });

  describe('ConferenceStateService + SSE', () => {
    let roomModel: { findAll: jest.Mock; findOne: jest.Mock; create: jest.Mock };
    let sequelize: { transaction: jest.Mock };
    let dialplanApplyService: { applyCategories: jest.Mock };
    let stateService: ConferenceStateService;
    let roomsService: ConferenceRoomsService;

    beforeEach(() => {
      roomModel = {
        findAll: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        create: jest.fn().mockResolvedValue(roomRow()),
      };
      sequelize = {
        transaction: jest.fn().mockResolvedValue({
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
        }),
      };
      dialplanApplyService = {
        applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 4 }),
      };
      stateService = new ConferenceStateService();
      roomsService = new ConferenceRoomsService(
        roomModel as any,
        sequelize as any,
        dialplanApplyService as any,
        stateService,
      );
    });

    it('joins then leaves a channel and drops unknown / reordered events', async () => {
      roomModel.findOne.mockResolvedValue(roomRow());
      await roomsService.create({ number: ROOM_NUMBER, name: 'Sales conf' } as any, VPBX);

      const events: unknown[] = [];
      const sub = stateService.getEventStream(ROOM_UID).subscribe((event) => events.push(event));

      stateService.handleJoin({
        Conference: 'conf6007_42',
        Channel: 'PJSIP/gst-0001',
        CallerIDNum: '6007',
        Admin: 'No',
        MarkedUser: 'No',
      });
      expect(stateService.getSnapshot(ROOM_UID).participants).toHaveLength(1);
      expect(stateService.getSnapshot(ROOM_UID).participants[0].role).toBe('participant');
      expect(events.length).toBeGreaterThan(0);

      stateService.handleLeave({
        Conference: 'conf6007_42',
        Channel: 'PJSIP/gst-0001',
      });
      expect(stateService.getSnapshot(ROOM_UID).participants).toHaveLength(0);

      const before = stateService.getSnapshot(ROOM_UID);
      expect(() => stateService.handleJoin({})).not.toThrow();
      expect(stateService.getSnapshot(ROOM_UID)).toEqual(before);

      stateService.handleLeave({
        Conference: 'conf6007_42',
        Channel: 'PJSIP/never-joined',
      });
      expect(stateService.getSnapshot(ROOM_UID).participants).toHaveLength(0);

      sub.unsubscribe();
    });

    it('opens SSE with fullSnapshot of the joined participant', async () => {
      roomModel.findOne.mockResolvedValue(roomRow());
      await roomsService.create({ number: ROOM_NUMBER, name: 'Sales conf' } as any, VPBX);
      stateService.handleJoin({
        Conference: 'conf6007_42',
        Channel: 'PJSIP/gst-0001',
        CallerIDNum: '6007',
        Admin: 'No',
        MarkedUser: 'No',
      });

      const controller = new ConferenceSseController(roomsService, stateService);
      const stream = controller.events(
        { user: { vpbx_user_uid: VPBX, sub: CREATOR_SUB } } as any,
        ROOM_UID,
      );
      const first = await firstValueFrom(stream);
      expect(first.type).toBe('fullSnapshot');
      const payload = typeof first.data === 'string' ? JSON.parse(first.data) : first.data;
      const participants = payload.participants ?? payload.data?.participants ?? payload;
      expect(Array.isArray(participants) ? participants : payload.participants).toHaveLength(1);
    });
  });

  describe('ami.service Confbridge listeners', () => {
    it('registers the five lowercase Confbridge events', () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, '../ami/ami.service.ts'),
        'utf8',
      );
      for (const name of [
        'confbridgejoin',
        'confbridgeleave',
        'confbridgetalking',
        'confbridgemute',
        'confbridgeunmute',
      ]) {
        expect(src).toContain(`'${name}'`);
      }
    });
  });
});
