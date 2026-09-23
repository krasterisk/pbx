import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CloudSetting } from '../cloud-admin/cloud-setting.model';
import { AiProvidersService } from './ai-providers.service';

export const SPEECH_ANALYTICS_STT_KEY = 'speech_analytics.stt_provider_uid';
export const SPEECH_ANALYTICS_LLM_KEY = 'speech_analytics.llm_provider_uid';

export type SpeechAnalyticsModelAssignment = {
  sttProviderUid: number | null;
  llmProviderUid: number | null;
  providers: Array<{
    uid: number;
    name: string;
    capabilities: string[];
    model: string | null;
    enabled: boolean;
  }>;
};

export type SpeechAnalyticsModelIds = {
  sttModelId: string | null;
  scoreModelId: string | null;
};

function parseUid(value: string | null | undefined): number | null {
  if (!value) return null;
  const uid = Number(value);
  return Number.isInteger(uid) && uid > 0 ? uid : null;
}

/**
 * Superadmin catalog assignment for speech analytics.
 * A cabinet without the right to edit its own models uses these provider ids.
 */
@Injectable()
export class PlatformSpeechModelsService {
  constructor(
    private readonly providers: AiProvidersService,
    @InjectModel(CloudSetting) private readonly settings: typeof CloudSetting,
  ) {}

  async get(): Promise<SpeechAnalyticsModelAssignment> {
    const rows = await this.providers.findGlobal();
    const [stt, llm] = await Promise.all([
      this.settings.findOne({ where: { key: SPEECH_ANALYTICS_STT_KEY } }),
      this.settings.findOne({ where: { key: SPEECH_ANALYTICS_LLM_KEY } }),
    ]);
    return {
      sttProviderUid: parseUid(stt?.value),
      llmProviderUid: parseUid(llm?.value),
      providers: rows.map((row) => ({
        uid: row.uid,
        name: row.name,
        capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
        model: typeof row.defaults?.model === 'string' ? row.defaults.model : null,
        enabled: row.enabled !== false,
      })),
    };
  }

  async set(sttProviderUid: number | null, llmProviderUid: number | null): Promise<SpeechAnalyticsModelAssignment> {
    await this.assertCapability(sttProviderUid, 'stt');
    await this.assertCapability(llmProviderUid, 'llm');
    await this.write(SPEECH_ANALYTICS_STT_KEY, sttProviderUid);
    await this.write(SPEECH_ANALYTICS_LLM_KEY, llmProviderUid);
    return this.get();
  }

  /** Model ids the analysis worker should use when the cabinet cannot pick its own. */
  async modelIds(): Promise<SpeechAnalyticsModelIds> {
    const assignment = await this.get();
    const stt = assignment.providers.find((row) => row.uid === assignment.sttProviderUid && row.enabled
      && row.capabilities.includes('stt'));
    const llm = assignment.providers.find((row) => row.uid === assignment.llmProviderUid && row.enabled
      && row.capabilities.includes('llm'));
    return {
      sttModelId: stt ? (stt.model || stt.name) : null,
      scoreModelId: llm ? (llm.model || llm.name) : null,
    };
  }

  private async assertCapability(uid: number | null, capability: 'stt' | 'llm') {
    if (uid == null) return;
    const rows = await this.providers.findGlobal();
    const row = rows.find((item) => item.uid === uid && item.enabled !== false
      && Array.isArray(item.capabilities) && item.capabilities.includes(capability));
    if (!row) throw new NotFoundException({ code: 'provider_not_found' });
  }

  private async write(key: string, uid: number | null) {
    const value = uid == null ? '' : String(uid);
    const existing = await this.settings.findOne({ where: { key } });
    if (existing) {
      await existing.update({ value });
      return;
    }
    await this.settings.create({ key, value, description: 'Speech analytics platform model' } as any);
  }
}
