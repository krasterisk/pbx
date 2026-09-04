import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { VoiceRobotsAiAdapter } from '../voice-robots/voice-robots-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const TTS_A = {
  uid: 20,
  name: 'yandex-alena',
  type: 'yandex',
  token: 'ya-secret-tenant-a-should-never-leak',
  settings: { voice: 'alena', role: 'neutral', folder_id: 'folder-a' },
  custom_url: null,
  auth_mode: 'bearer',
  custom_headers: { Authorization: 'Api-Key leak-a' },
  user_uid: TENANT_A,
};

const STT_A_UNCONFIGURED = {
  uid: 10,
  name: 'yandex-stt',
  type: 'yandex',
  token: '',
  settings: { language: 'ru-RU' },
  custom_url: null,
  auth_mode: 'none',
  custom_headers: {},
  user_uid: TENANT_A,
};

const ROBOT_A = {
  uid: 1,
  name: 'sales-bot',
  description: 'Inbound sales',
  active: 1,
  language: 'ru-RU',
  stt_engine_id: 10,
  tts_engine_id: 20,
  greeting_tts_text: 'Здравствуйте, чем помочь?',
  initial_group_id: 5,
  user_uid: TENANT_A,
};

const ROBOT_A_DANGLING = {
  ...ROBOT_A,
  uid: 2,
  name: 'broken-bot',
  stt_engine_id: 999,
  tts_engine_id: 20,
};

const ROBOT_B = {
  uid: 9,
  name: 'other-tenant-bot',
  description: 'Tenant B secret robot',
  active: 1,
  language: 'en-US',
  stt_engine_id: 90,
  tts_engine_id: 91,
  greeting_tts_text: 'Tenant B greeting',
  initial_group_id: 50,
  user_uid: TENANT_B,
};

const GROUP_A = { uid: 5, name: 'intent-sales', priority: 1, active: 1, robot_id: 1 };
const ENTRY_A = {
  routeUid: 7,
  routeName: 'in-sales',
  location: 'actions[0]',
  extensions: ['74951234567'],
};

function getTool(adapter: { getTools: () => Array<{ name: string }> }, name: string) {
  const tool = adapter.getTools().find((entry) => entry.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool as {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    entityType: string;
    proposes?: boolean;
    destructive?: boolean;
    handler: (args: Record<string, unknown>, uid: number) => Promise<unknown>;
  };
}

function isMutating(tool: { name: string; proposes?: boolean; destructive?: boolean }): boolean {
  return Boolean(tool.proposes || tool.destructive);
}

describe('read-adapters-speech — voice robots (D-12, D-15)', () => {
  let voiceRobots: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    getKeywordGroups: jest.Mock;
    createRobot: jest.Mock;
    updateRobot: jest.Mock;
    deleteRobot: jest.Mock;
  };
  let ttsEngines: { findOne: jest.Mock; findAll: jest.Mock };
  let sttEngines: { findOne: jest.Mock; findAll: jest.Mock };
  let routeReferences: { findReferences: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: VoiceRobotsAiAdapter;

  beforeEach(() => {
    voiceRobots = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...ROBOT_A }, { ...ROBOT_A_DANGLING }];
        if (uid === TENANT_B) return [{ ...ROBOT_B }];
        return [];
      }),
      findOne: jest.fn(async (uid: number, robotUid: number) => {
        const rows = uid === TENANT_A ? [ROBOT_A, ROBOT_A_DANGLING] : uid === TENANT_B ? [ROBOT_B] : [];
        const found = rows.find((row) => row.uid === robotUid);
        if (!found) throw new NotFoundException(`Robot ${robotUid} not found`);
        return { ...found };
      }),
      getKeywordGroups: jest.fn(async (uid: number, robotId: number) => {
        if (uid === TENANT_A && robotId === ROBOT_A.uid) return [{ ...GROUP_A }];
        return [];
      }),
      createRobot: jest.fn(),
      updateRobot: jest.fn(),
      deleteRobot: jest.fn(),
    };
    ttsEngines = {
      findAll: jest.fn(),
      findOne: jest.fn(async (engineUid: number, uid: number) => {
        if (uid === TENANT_A && engineUid === TTS_A.uid) return { ...TTS_A };
        throw new NotFoundException('TTS Engine not found');
      }),
    };
    sttEngines = {
      findAll: jest.fn(),
      findOne: jest.fn(async (engineUid: number, uid: number) => {
        if (uid === TENANT_A && engineUid === STT_A_UNCONFIGURED.uid) return { ...STT_A_UNCONFIGURED };
        throw new NotFoundException('STT Engine not found');
      }),
    };
    routeReferences = {
      findReferences: jest.fn(async (kind: string, robotUid: number, uid: number) => {
        if (kind === 'voicerobot' && uid === TENANT_A && robotUid === ROBOT_A.uid) return [{ ...ENTRY_A }];
        return [];
      }),
    };
    registry = { register: jest.fn() };
    adapter = new VoiceRobotsAiAdapter(
      voiceRobots as any,
      ttsEngines as any,
      sttEngines as any,
      registry as any,
      routeReferences as any,
    );
  });

  it('lists the tenant voice robots with their status and entry points', async () => {
    const result = (await getTool(adapter, 'list_voice_robots').handler({}, TENANT_A)) as {
      robots: Array<{ uid: number; name: string; status: string; entry_points: Array<{ route_name?: string }> }>;
    };
    expect(result.robots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: 1,
          name: 'sales-bot',
          status: 'active',
          entry_points: [expect.objectContaining({ route_name: 'in-sales', route_uid: 7 })],
        }),
      ]),
    );
    expect(routeReferences.findReferences).toHaveBeenCalledWith('voicerobot', 1, TENANT_A);
  });

  it('describes one robot with its scenario outline and referenced speech engines', async () => {
    const result = (await getTool(adapter, 'describe_voice_robot').handler({ uid: 1 }, TENANT_A)) as {
      uid: number;
      scenario: { greeting?: string; groups: Array<{ name: string }> };
      speech_engines: Array<{ kind: string; name?: string | null; configured: boolean; missing?: boolean }>;
    };
    expect(result.uid).toBe(1);
    expect(result.scenario.greeting).toMatch(/Здравствуйте/);
    expect(result.scenario.groups).toEqual([expect.objectContaining({ name: 'intent-sales' })]);
    expect(result.speech_engines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'tts', name: 'yandex-alena', configured: true, missing: false }),
        expect.objectContaining({ kind: 'stt', name: 'yandex-stt', configured: false, missing: false }),
      ]),
    );
  });

  it('reports a dangling engine reference as a missing dependency instead of omitting it', async () => {
    const result = (await getTool(adapter, 'describe_voice_robot').handler({ uid: 2 }, TENANT_A)) as {
      speech_engines: Array<{ kind: string; uid: number; missing: boolean; configured: boolean }>;
    };
    const stt = result.speech_engines.find((row) => row.kind === 'stt');
    expect(stt).toEqual(expect.objectContaining({ uid: 999, missing: true, configured: false }));
    expect(result.speech_engines.find((row) => row.kind === 'tts')).toEqual(
      expect.objectContaining({ uid: 20, missing: false, configured: true }),
    );
  });

  it('declares no mutating tool', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
      expect(tool.name).not.toMatch(/create|update|delete|write|apply/i);
    }
    expect(voiceRobots.createRobot).not.toHaveBeenCalled();
    expect(voiceRobots.updateRobot).not.toHaveBeenCalled();
    expect(voiceRobots.deleteRobot).not.toHaveBeenCalled();
  });

  it('returns none of another tenant robots', async () => {
    const result = await getTool(adapter, 'list_voice_robots').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).toContain('sales-bot');
    expect(blob).not.toContain('other-tenant-bot');
    expect(blob).not.toContain('Tenant B');
    expect(voiceRobots.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(voiceRobots.findAll).not.toHaveBeenCalledWith(TENANT_B);
  });

  it('ships a voice-robots skill covering reachability, engine dependencies and describe-first diagnosis', () => {
    const skillPath = path.join(__dirname, '../../skills/voice-robots/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf8');
    expect(raw).toMatch(/^---\r?\nname: voice-robots\r?\ndescription: .+\r?\n---/);
    expect(raw).toMatch(/маршрут|route|вход|entry/i);
    expect(raw).toMatch(/tts|stt|движ/i);
    expect(raw).toMatch(/describe_voice_robot/);
    expect(raw).toMatch(/не угад|before speculat|сначала прочит|уже сообщ/i);
  });
});
