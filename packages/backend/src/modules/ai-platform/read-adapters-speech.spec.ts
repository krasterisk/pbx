import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { VoiceRobotsAiAdapter } from '../voice-robots/voice-robots-ai.adapter';
import {
  STT_ENGINE_ALLOW_LIST,
  SttEnginesAiAdapter,
  toSttEngineView,
} from '../stt-engines/stt-engines-ai.adapter';
import {
  TTS_ENGINE_ALLOW_LIST,
  TtsEnginesAiAdapter,
  toTtsEngineView,
} from '../tts-engines/tts-engines-ai.adapter';

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

const STT_A = {
  uid: 10,
  name: 'yandex-stt',
  type: 'yandex',
  token: 'stt-secret-tenant-a-should-never-leak',
  settings: { language: 'ru-RU', folder_id: 'stt-folder-a' },
  custom_url: 'https://stt.example.test/v1',
  auth_mode: 'bearer',
  custom_headers: { Authorization: 'Bearer stt-leak-a' },
  user_uid: TENANT_A,
};

const TTS_B = {
  uid: 91,
  name: 'other-tts',
  type: 'google',
  token: 'google-secret-tenant-b',
  settings: { language_code: 'en-US', voice_name: 'en-US-Wavenet-A' },
  custom_url: null,
  auth_mode: 'bearer',
  custom_headers: {},
  user_uid: TENANT_B,
};

const STT_B = {
  uid: 90,
  name: 'other-stt',
  type: 'custom',
  token: 'stt-secret-tenant-b',
  settings: { language: 'en-US' },
  custom_url: 'https://stt-b.example.test/v1',
  auth_mode: 'bearer',
  custom_headers: { Authorization: 'Bearer stt-leak-b' },
  user_uid: TENANT_B,
};

const TTS_A_CUSTOM_EMPTY = {
  uid: 21,
  name: 'custom-silent',
  type: 'custom',
  token: '',
  settings: {},
  custom_url: '',
  auth_mode: 'none',
  custom_headers: {},
  user_uid: TENANT_A,
};

const CREDENTIAL_SHAPE = /token|secret|password|key|credential|encrypted|url|header|endpoint|auth/i;

function expectAllowListSafe(allowList: readonly string[]) {
  for (const field of allowList) {
    expect(field).not.toMatch(CREDENTIAL_SHAPE);
  }
}

function expectNoCredentials(result: unknown) {
  const blob = JSON.stringify(result);
  expect(blob).not.toMatch(
    /ya-secret|stt-secret|google-secret|folder-a|stt-folder|stt\.example|stt-b\.example|Api-Key leak|Bearer stt-leak|custom_url|custom_headers|encrypted/i,
  );
}

function engineKeys(row: Record<string, unknown>): string[] {
  return Object.keys(row).sort();
}

describe('read-adapters-speech — tts engines (D-15, secret boundary)', () => {
  let ttsEngines: { findAll: jest.Mock; findOne: jest.Mock; create: jest.Mock; synthesize: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: TtsEnginesAiAdapter;

  beforeEach(() => {
    ttsEngines = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...TTS_A }, { ...TTS_A_CUSTOM_EMPTY }];
        if (uid === TENANT_B) return [{ ...TTS_B }];
        return [];
      }),
      findOne: jest.fn(),
      create: jest.fn(),
      synthesize: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new TtsEnginesAiAdapter(ttsEngines as any, registry as any);
  });

  it('returns name, vendor, enabled state, capabilities and configured for each engine', async () => {
    const result = (await getTool(adapter, 'list_tts_engines').handler({}, TENANT_A)) as {
      engines: Array<{
        name: string;
        vendor: string;
        enabled: boolean;
        capabilities: Record<string, unknown>;
        configured: boolean;
      }>;
    };
    expect(result.engines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'yandex-alena',
          vendor: 'yandex',
          enabled: true,
          configured: true,
          capabilities: expect.objectContaining({ voice: 'alena', role: 'neutral' }),
        }),
        expect.objectContaining({ name: 'custom-silent', vendor: 'custom', configured: false }),
      ]),
    );
  });

  it('builds output from an explicit allow list and never returns a provider key, endpoint or encrypted value', async () => {
    const result = (await getTool(adapter, 'list_tts_engines').handler({}, TENANT_A)) as {
      engines: Array<Record<string, unknown>>;
    };
    expectNoCredentials(result);
    expectAllowListSafe(TTS_ENGINE_ALLOW_LIST);
    for (const row of result.engines) {
      expect(engineKeys(row)).toEqual([...TTS_ENGINE_ALLOW_LIST].sort());
    }
  });

  it('asserts credential absence against the declared output shape, not only fixtures', () => {
    expectAllowListSafe(TTS_ENGINE_ALLOW_LIST);
    const fat = {
      uid: 8,
      name: 'fat-tts',
      type: 'custom',
      token: 'sk-fat-tts',
      custom_url: 'https://tts-fat.example/synth',
      auth_mode: 'bearer',
      custom_headers: { Authorization: 'Bearer fat' },
      settings: { voice: 'ok', api_key: 'should-drop', endpoint: 'https://drop.me' },
      encrypted_blob: 'iv:tag:ciphertext',
      user_uid: TENANT_A,
    };
    const view = toTtsEngineView(fat);
    expect(engineKeys(view as unknown as Record<string, unknown>)).toEqual([...TTS_ENGINE_ALLOW_LIST].sort());
    expect(JSON.stringify(view)).not.toMatch(/sk-fat|tts-fat|Bearer fat|api_key|iv:tag|encrypted_blob|drop\.me/i);
    expect(view.capabilities).toEqual({ voice: 'ok' });
  });

  it('declares no tool that synthesises audio', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
      expect(tool.name).not.toMatch(/synth|speak|generate|play|render/i);
    }
    expect(ttsEngines.synthesize).not.toHaveBeenCalled();
    expect(ttsEngines.create).not.toHaveBeenCalled();
  });

  it('returns none of another tenant tts engines', async () => {
    const result = await getTool(adapter, 'list_tts_engines').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).toContain('yandex-alena');
    expect(blob).not.toContain('other-tts');
    expect(blob).not.toContain('google-secret');
    expect(ttsEngines.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(ttsEngines.findAll).not.toHaveBeenCalledWith(TENANT_B);
  });
});

describe('read-adapters-speech — stt engines (D-15, secret boundary)', () => {
  let sttEngines: { findAll: jest.Mock; findOne: jest.Mock; transcribe: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: SttEnginesAiAdapter;

  beforeEach(() => {
    sttEngines = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...STT_A }];
        if (uid === TENANT_B) return [{ ...STT_B }];
        return [];
      }),
      findOne: jest.fn(),
      transcribe: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new SttEnginesAiAdapter(sttEngines as any, registry as any);
  });

  it('returns name, vendor, enabled state, capabilities and configured for each engine', async () => {
    const result = (await getTool(adapter, 'list_stt_engines').handler({}, TENANT_A)) as {
      engines: Array<{
        name: string;
        vendor: string;
        enabled: boolean;
        capabilities: Record<string, unknown>;
        configured: boolean;
      }>;
    };
    expect(result.engines).toEqual([
      expect.objectContaining({
        name: 'yandex-stt',
        vendor: 'yandex',
        enabled: true,
        configured: true,
        capabilities: expect.objectContaining({ language: 'ru-RU' }),
      }),
    ]);
  });

  it('builds output from an explicit allow list and never returns a provider key, endpoint or encrypted value', async () => {
    const result = (await getTool(adapter, 'list_stt_engines').handler({}, TENANT_A)) as {
      engines: Array<Record<string, unknown>>;
    };
    expectNoCredentials(result);
    expectAllowListSafe(STT_ENGINE_ALLOW_LIST);
    for (const row of result.engines) {
      expect(engineKeys(row)).toEqual([...STT_ENGINE_ALLOW_LIST].sort());
    }
  });

  it('asserts credential absence against the declared output shape, not only fixtures', () => {
    expectAllowListSafe(STT_ENGINE_ALLOW_LIST);
    const fat = {
      uid: 3,
      name: 'fat-stt',
      type: 'yandex',
      token: 'sk-fat-stt',
      custom_url: 'https://stt-fat.example/asr',
      custom_headers: { 'X-Api-Key': 'fat-key' },
      settings: { language: 'ru-RU', api_token: 'drop-me' },
      encrypted_value: 'enc-blob',
    };
    const view = toSttEngineView(fat);
    expect(engineKeys(view as unknown as Record<string, unknown>)).toEqual([...STT_ENGINE_ALLOW_LIST].sort());
    expect(JSON.stringify(view)).not.toMatch(/sk-fat|stt-fat|fat-key|api_token|enc-blob|drop-me/i);
    expect(view.capabilities).toEqual({ language: 'ru-RU' });
  });

  it('declares no tool that transcribes audio', () => {
    expect(adapter.getTools().length).toBeGreaterThan(0);
    for (const tool of adapter.getTools()) {
      expect(isMutating(tool)).toBe(false);
      expect(tool.name).not.toMatch(/transcri|recognize|listen|decode/i);
    }
    expect(sttEngines.transcribe).not.toHaveBeenCalled();
  });

  it('returns none of another tenant stt engines', async () => {
    const result = await getTool(adapter, 'list_stt_engines').handler({}, TENANT_A);
    const blob = JSON.stringify(result);
    expect(blob).toContain('yandex-stt');
    expect(blob).not.toContain('other-stt');
    expect(blob).not.toContain('stt-secret-tenant-b');
    expect(sttEngines.findAll).toHaveBeenCalledWith(TENANT_A);
    expect(sttEngines.findAll).not.toHaveBeenCalledWith(TENANT_B);
  });
});
