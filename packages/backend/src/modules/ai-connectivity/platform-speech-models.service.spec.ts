import { NotFoundException } from '@nestjs/common';
import { PlatformSpeechModelsService } from './platform-speech-models.service';

describe('PlatformSpeechModelsService', () => {
  const globalRow = {
    uid: 4,
    name: 'Platform STT',
    capabilities: ['stt'],
    defaults: { model: 'whisper-1' },
    enabled: true,
  };
  const llmRow = {
    uid: 5,
    name: 'Platform LLM',
    capabilities: ['llm'],
    defaults: { model: 'gpt-4o-mini' },
    enabled: true,
  };

  function build() {
    const providers = {
      findGlobal: jest.fn().mockResolvedValue([globalRow, llmRow]),
    };
    const rows = new Map<string, { value: string; update: jest.Mock }>();
    const settings = {
      findOne: jest.fn(async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null),
      create: jest.fn(async (row: { key: string; value: string }) => {
        const stored = { value: row.value, update: jest.fn(async (patch: { value: string }) => {
          stored.value = patch.value;
        }) };
        rows.set(row.key, stored);
        return stored;
      }),
    };
    const service = new PlatformSpeechModelsService(providers as any, settings as any);
    return { service, providers, rows };
  }

  it('assigns global STT and LLM and exposes their model ids', async () => {
    const { service } = build();
    const saved = await service.set(4, 5);
    expect(saved.sttProviderUid).toBe(4);
    expect(saved.llmProviderUid).toBe(5);
    await expect(service.modelIds()).resolves.toEqual({
      sttModelId: 'whisper-1',
      scoreModelId: 'gpt-4o-mini',
    });
  });

  it('rejects a global row that does not provide the requested capability', async () => {
    const { service } = build();
    await expect(service.set(5, 4)).rejects.toBeInstanceOf(NotFoundException);
  });
});
