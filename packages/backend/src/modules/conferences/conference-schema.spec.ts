import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';
import { CONFERENCE_SCHEMA_STATEMENTS } from './setup-conferences-schema';
import { ConferenceRoom } from './models/conference-room.model';
import { ConferenceRoomModerator } from './models/conference-room-moderator.model';
import { ConferenceGuestToken } from './models/conference-guest-token.model';
import { ConferenceMeeting } from './models/conference-meeting.model';
import { ConferenceMeetingParticipant } from './models/conference-meeting-participant.model';

const CHILD_MODEL_FILES = [
  'conference-room-moderator.model.ts',
  'conference-guest-token.model.ts',
  'conference-meeting.model.ts',
  'conference-meeting-participant.model.ts',
] as const;

const CHILD_MODELS = [
  { Model: ConferenceRoomModerator, table: 'conference_room_moderators' },
  { Model: ConferenceGuestToken, table: 'conference_guest_tokens' },
  { Model: ConferenceMeeting, table: 'conference_meetings' },
  { Model: ConferenceMeetingParticipant, table: 'conference_meeting_participants' },
] as const;

function statementForTable(table: string): string {
  const found = CONFERENCE_SCHEMA_STATEMENTS.find((sql) =>
    sql.includes(`\`${table}\``),
  );
  if (!found) {
    throw new Error(`No CONFERENCE_SCHEMA_STATEMENTS entry for ${table}`);
  }
  return found;
}

function columnNamesFromCreateTable(sql: string): string[] {
  const cols: string[] = [];
  const re = /^\s+`([a-z_]+)`\s+(INT|VARCHAR|ENUM|TINYINT|DATETIME)/gim;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    cols.push(match[1]);
  }
  return cols;
}

function modelFieldNames(model: typeof ConferenceRoomModerator): string[] {
  return Object.entries(model.getAttributes()).map(([key, attr]) => {
    const field = (attr as { field?: string }).field;
    return field ?? key;
  });
}

describe('conference schema (16-01 Task 3)', () => {
  describe('DDL', () => {
    it('exports exactly five idempotent CREATE TABLE statements and never DROP', () => {
      expect(CONFERENCE_SCHEMA_STATEMENTS).toHaveLength(5);
      for (const statement of CONFERENCE_SCHEMA_STATEMENTS) {
        expect(statement.trimStart().startsWith('CREATE TABLE IF NOT EXISTS')).toBe(true);
        expect(statement).not.toMatch(/DROP/i);
      }
    });

    it('puts the tenant column on conference_rooms only', () => {
      const withTenant = CONFERENCE_SCHEMA_STATEMENTS.filter((s) =>
        s.includes('vpbx_user_uid'),
      );
      expect(withTenant).toHaveLength(1);
      expect(withTenant[0]).toMatch(/conference_rooms/);
    });

    it('cascades FK deletes on every child table', () => {
      const childTables = [
        'conference_room_moderators',
        'conference_guest_tokens',
        'conference_meetings',
        'conference_meeting_participants',
      ];
      for (const table of childTables) {
        expect(statementForTable(table)).toContain('ON DELETE CASCADE');
      }
    });
  });

  describe('child models', () => {
    let sequelize: Sequelize;

    beforeAll(() => {
      sequelize = new Sequelize({
        dialect: 'mysql',
        host: '127.0.0.1',
        username: 'x',
        password: 'x',
        database: 'x',
        logging: false,
        models: [
          ConferenceRoom,
          ConferenceRoomModerator,
          ConferenceGuestToken,
          ConferenceMeeting,
          ConferenceMeetingParticipant,
        ],
      });
    });

    afterAll(async () => {
      await sequelize.close();
    });

    it('declares tableName matching the DDL table for each child model', () => {
      for (const { Model, table } of CHILD_MODELS) {
        expect(Model.getTableName()).toBe(table);
      }
    });

    it('does not declare vpbx_user_uid or user_uid on any child model', () => {
      const modelsDir = path.resolve(__dirname, 'models');
      for (const file of CHILD_MODEL_FILES) {
        const src = fs.readFileSync(path.join(modelsDir, file), 'utf8');
        expect(src).not.toContain('vpbx_user_uid');
        expect(src).not.toMatch(/\buser_uid\b/);
      }
      for (const { Model } of CHILD_MODELS) {
        const attrs = Model.getAttributes();
        expect(attrs).not.toHaveProperty('user_uid');
        expect(attrs).not.toHaveProperty('vpbx_user_uid');
        expect(modelFieldNames(Model)).not.toContain('vpbx_user_uid');
      }
    });

    it('maps each child model field set onto the matching CREATE TABLE columns', () => {
      for (const { Model, table } of CHILD_MODELS) {
        const sqlCols = columnNamesFromCreateTable(statementForTable(table)).sort();
        const modelCols = modelFieldNames(Model).sort();
        expect(modelCols).toEqual(sqlCols);
      }
    });

    it('declares ConferenceGuestToken.token as STRING(64) not null', () => {
      const token = ConferenceGuestToken.getAttributes().token as {
        allowNull?: boolean;
        type?: { toString: () => string };
      };
      expect(token.allowNull).toBe(false);
      expect(String(token.type)).toMatch(/VARCHAR\(64\)|STRING\(64\)/i);
    });
  });

  describe('wiring', () => {
    it('registers db:setup:conferences next to db:setup:directories', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'),
      ) as { scripts: Record<string, string> };
      expect(pkg.scripts['db:setup:conferences']).toBe(
        'ts-node -r tsconfig-paths/register src/modules/conferences/setup-conferences-schema.ts',
      );
      expect(pkg.scripts['db:setup:directories']).toContain('setup-directories-schema.ts');
    });

    it('registers five domain models in SequelizeModule.forFeature', () => {
      const src = fs.readFileSync(path.resolve(__dirname, './conferences.module.ts'), 'utf8');
      const match = src.match(/SequelizeModule\.forFeature\(\[([^\]]+)\]/);
      expect(match).toBeTruthy();
      const models = match![1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      expect(models).toEqual(
        expect.arrayContaining([
          'ConferenceRoom',
          'ConferenceRoomModerator',
          'ConferenceGuestToken',
          'ConferenceMeeting',
          'ConferenceMeetingParticipant',
          'User',
        ]),
      );
    });
  });
});
