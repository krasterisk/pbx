import { NotFoundException } from '@nestjs/common';
import { VoicemailAiAdapter } from './voicemail-ai.adapter';

/**
 * Unit tests for VoicemailAiAdapter — Domain AI Adapter for voicemail (D-58).
 * Plain instantiation (no Nest TestingModule), matching directories-ai.adapter.spec.ts.
 */
describe('VoicemailAiAdapter', () => {
  let voicemailService: {
    list: jest.Mock;
    findByUniqueid: jest.Mock;
  };
  let registry: { register: jest.Mock };
  let adapter: VoicemailAiAdapter;

  const TOOL_NAMES = ['list_voicemail_messages', 'get_voicemail_message'];

  const getTool = (name: string) => adapter.getTools().find((t) => t.name === name)!;

  const detailRow = {
    uid: 7,
    vpbx_user_uid: 42,
    uniqueid: '1760000000.1',
    file_rel: '42/voicemail/1760000000.1.wav',
    record_status: 'OK',
    caller_id: '79001234567',
    exten: '100',
    duration_sec: 12,
    notify_status: 'sent',
    transcript_status: 'ready',
    notify_attempts: 0,
    transcript_attempts: 1,
    next_notify_at: null,
    scan_locked_until: null,
    transcript: 'перезвоните',
    summary: 'Просьба перезвонить',
    notify_error: undefined,
    created_at: new Date('2026-09-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    voicemailService = {
      list: jest.fn().mockResolvedValue([]),
      findByUniqueid: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new VoicemailAiAdapter(voicemailService as any, registry as any);
  });

  describe('getTools', () => {
    it('exposes list_voicemail_messages and get_voicemail_message', () => {
      expect(adapter.getTools().map((t) => t.name)).toEqual(TOOL_NAMES);
    });

    it('does not register a delete tool', () => {
      expect(adapter.getTools().some((t) => t.name.includes('delete'))).toBe(false);
    });

    it('does not mark either tool as destructive', () => {
      expect(getTool('list_voicemail_messages').destructive).toBeUndefined();
      expect(getTool('get_voicemail_message').destructive).toBeUndefined();
    });

    it('sets entityType to voicemail_message on every tool', () => {
      for (const name of TOOL_NAMES) {
        expect(getTool(name).entityType).toBe('voicemail_message');
      }
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with AiAdapterRegistryService', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('tenant isolation via vpbxUserUid parameter', () => {
    it('list_voicemail_messages passes the call-time uid, not a closure', async () => {
      await getTool('list_voicemail_messages').handler({}, 111);
      await getTool('list_voicemail_messages').handler({}, 222);
      expect(voicemailService.list).toHaveBeenNthCalledWith(1, 111);
      expect(voicemailService.list).toHaveBeenNthCalledWith(2, 222);
    });

    it('get_voicemail_message passes the call-time uid to findByUniqueid', async () => {
      voicemailService.findByUniqueid.mockResolvedValue(detailRow);
      await getTool('get_voicemail_message').handler({ uniqueid: '1760000000.1' }, 42);
      expect(voicemailService.findByUniqueid).toHaveBeenCalledWith(42, '1760000000.1');
    });

    it('get-by-uniqueid for another tenant returns not-found', async () => {
      voicemailService.findByUniqueid.mockRejectedValue(
        new NotFoundException('Voicemail message not found'),
      );
      const result = await getTool('get_voicemail_message').handler(
        { uniqueid: '1760000000.1' },
        99,
      );
      expect(voicemailService.findByUniqueid).toHaveBeenCalledWith(99, '1760000000.1');
      expect(result).toEqual({ found: false });
    });
  });

  describe('payload hygiene', () => {
    it('omits token and play-by-token fields from list results', async () => {
      voicemailService.list.mockResolvedValue([
        {
          ...detailRow,
          token: 'deadbeef',
          play_token: 'cafe',
          playUrl: 'https://pbx.example/api/voicemail/play?token=abc',
          play_url: 'https://pbx.example/api/voicemail/play?token=abc',
        },
      ]);
      const result = (await getTool('list_voicemail_messages').handler({}, 42)) as {
        messages: Record<string, unknown>[];
      };
      expect(result.messages).toHaveLength(1);
      const payload = JSON.stringify(result);
      expect(payload).not.toMatch(/token/i);
      expect(payload).not.toMatch(/play/i);
      expect(result.messages[0]).not.toHaveProperty('token');
      expect(result.messages[0]).not.toHaveProperty('playUrl');
      expect(result.messages[0].uniqueid).toBe('1760000000.1');
    });

    it('omits token and play-by-token fields from get results', async () => {
      voicemailService.findByUniqueid.mockResolvedValue({
        ...detailRow,
        token: 'deadbeef',
        playUrl: 'https://pbx.example/api/voicemail/play?token=abc',
      });
      const result = (await getTool('get_voicemail_message').handler(
        { uniqueid: '1760000000.1' },
        42,
      )) as Record<string, unknown>;
      const payload = JSON.stringify(result);
      expect(payload).not.toMatch(/token/i);
      expect(payload).not.toMatch(/play/i);
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('playUrl');
      expect(result.uniqueid).toBe('1760000000.1');
    });
  });

  describe('getStateProvider', () => {
    it('summarizes the tenant message count', async () => {
      voicemailService.list.mockResolvedValue([detailRow, { ...detailRow, uid: 8 }]);
      const summary = await adapter.getStateProvider().buildSummary(42);
      expect(voicemailService.list).toHaveBeenCalledWith(42);
      expect(summary).toMatch(/2/);
      expect(summary).toMatch(/голос/i);
    });
  });

  describe('getKnowledgeBlock', () => {
    it('covers two-axis statuses, CDR tab, and no MWI', () => {
      const kb = adapter.getKnowledgeBlock();
      expect(kb).toMatch(/notify_status|notify/i);
      expect(kb).toMatch(/transcript_status|transcript/i);
      expect(kb).toMatch(/CDR|cdr/i);
      expect(kb).toMatch(/MWI/i);
      expect(kb).toMatch(/нет|не использ|без MWI|no MWI/i);
    });
  });
});
