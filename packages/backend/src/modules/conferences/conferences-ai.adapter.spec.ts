import { ConferencesAiAdapter } from './conferences-ai.adapter';
import { MODULE_COVERAGE } from '../ai-platform/module-coverage.registry';

/**
 * Unit tests for ConferencesAiAdapter (D-41).
 * Plain instantiation (no Nest TestingModule), matching callcenter-ai.adapter.spec.ts.
 */
describe('ConferencesAiAdapter', () => {
  let roomsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let registry: { register: jest.Mock };
  let adapter: ConferencesAiAdapter;

  const getTool = (name: string) => adapter.getTools().find((t) => t.name === name)!;

  beforeEach(() => {
    roomsService = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new ConferencesAiAdapter(roomsService as any, registry as any);
  });

  describe('tool declarations', () => {
    it('exposes domain conferences and list + update tools', () => {
      expect(adapter.domain).toBe('conferences');
      expect(adapter.getTools().map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['list_conference_rooms', 'update_conference_room']),
      );
    });

    it('marks update as proposing and list as a read', () => {
      expect(getTool('update_conference_room').proposes).toBe(true);
      expect(getTool('list_conference_rooms').proposes).toBeFalsy();
    });

    it('does not put vpbxUserUid in any inputSchema', () => {
      for (const tool of adapter.getTools()) {
        expect(Object.keys(tool.inputSchema ?? {})).not.toContain('vpbxUserUid');
        expect(Object.keys(tool.inputSchema ?? {})).not.toContain('vpbx_user_uid');
        expect(Object.keys(tool.inputSchema ?? {})).not.toContain('user_uid');
      }
    });
  });

  describe('list_conference_rooms', () => {
    it('calls findAll with the handler uid and returns uid/number/name only', async () => {
      roomsService.findAll.mockResolvedValue([
        {
          uid: 7,
          number: '800',
          name: 'Standup',
          sip_id: 'secret-sip',
          channel: 'PJSIP/e101_1',
          conf_bridge: 'conf800_42',
          pin: '1234',
        },
      ]);

      const result = await getTool('list_conference_rooms').handler({}, 42);

      expect(roomsService.findAll).toHaveBeenCalledWith(42);
      expect(result).toEqual({ rooms: [{ uid: 7, number: '800', name: 'Standup' }] });
      expect(JSON.stringify(result)).not.toMatch(/sip|channel|conf800_42|pin/i);
    });
  });

  describe('update_conference_room', () => {
    it('returns a pending proposal and does not write', async () => {
      roomsService.findOne.mockResolvedValue({
        uid: 7,
        number: '800',
        name: 'Standup',
        pin: null,
        wait_marked: false,
        end_marked: false,
        record_mode: 'off',
        notify_recording: true,
        announce_join_leave: false,
        entry_strictness: 'token_name',
        musiconhold: null,
        invite_external_scope: 'owner',
      });

      const result = await getTool('update_conference_room').handler({ uid: 7, name: 'Daily' }, 42);

      expect(roomsService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'update_conference_room' }));
      expect(result.applyPayload.args.uid).toBe(7);
      expect(result.applyPayload.args.name).toBe('Daily');
    });
  });

  describe('coverage still excluded until Task 3', () => {
    it('keeps conferences excluded so completeness stays green', () => {
      expect(MODULE_COVERAGE.conferences).toEqual(
        expect.objectContaining({ kind: 'excluded' }),
      );
    });
  });
});
