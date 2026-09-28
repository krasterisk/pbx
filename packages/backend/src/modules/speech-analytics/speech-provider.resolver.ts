import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { SaProjectConfigV1 } from '@krasterisk/shared';
import { PlatformSpeechModelsService } from '../ai-connectivity/platform-speech-models.service';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { Tenant } from '../cloud-admin/tenant.model';
import {
  providerUid,
  resolveSpeechProviders,
  type SpeechProviderChoice,
} from './speech-provider-resolve';

export type ResolvedSpeechProviders = SpeechProviderChoice & {
  ownModels: boolean;
  projectOverride: boolean;
  providers: Array<{
    uid: number;
    name: string;
    capabilities: string[];
    model: string | null;
    enabled: boolean;
  }>;
};

@Injectable()
export class SpeechProviderResolver {
  constructor(
    private readonly platformModels: PlatformSpeechModelsService,
    private readonly providers: AiProvidersService,
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
  ) {}

  async resolve(tenantUid: number, project: SaProjectConfigV1 | null): Promise<ResolvedSpeechProviders> {
    const [platform, tenant, rows] = await Promise.all([
      this.platformModels.get(),
      this.tenants.findOne({ where: { vpbx_user_uid: tenantUid } }),
      this.providers.findAll(tenantUid),
    ]);
    const ownModels = tenant?.sa_own_models === true;
    const projectOverride = ownModels && tenant?.sa_project_model_override === true;
    const choice = resolveSpeechProviders({
      ownModels,
      projectOverride,
      project: {
        sttProviderUid: providerUid(project?.sttProviderUid),
        llmProviderUid: providerUid(project?.llmProviderUid),
      },
      tenant: {
        sttProviderUid: ownModels ? providerUid(tenant?.sa_stt_provider_uid) : null,
        llmProviderUid: ownModels ? providerUid(tenant?.sa_llm_provider_uid) : null,
      },
      platform: {
        sttProviderUid: platform.sttProviderUid,
        llmProviderUid: platform.llmProviderUid,
      },
    });
    return {
      ...choice,
      ownModels,
      projectOverride,
      providers: rows
        .filter((row) => row.enabled !== false)
        .map((row) => ({
          uid: row.uid,
          name: row.name,
          capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
          model: typeof row.defaults?.model === 'string' ? row.defaults.model : null,
          enabled: true,
        })),
    };
  }

  async describe(tenantUid: number): Promise<ResolvedSpeechProviders> {
    const tenant = await this.tenants.findOne({ where: { vpbx_user_uid: tenantUid } });
    const resolved = await this.resolve(tenantUid, null);
    return {
      ...resolved,
      sttProviderUid: providerUid(tenant?.sa_stt_provider_uid),
      llmProviderUid: providerUid(tenant?.sa_llm_provider_uid),
    };
  }

  async saveTenant(tenantUid: number, patch: {
    sttProviderUid?: number | null;
    llmProviderUid?: number | null;
    projectOverride?: boolean;
  }): Promise<ResolvedSpeechProviders> {
    const tenant = await this.tenants.findOne({ where: { vpbx_user_uid: tenantUid } });
    if (!tenant || tenant.sa_own_models !== true) {
      return this.describe(tenantUid);
    }
    const next: Record<string, unknown> = {};
    if (patch.sttProviderUid !== undefined) next.sa_stt_provider_uid = providerUid(patch.sttProviderUid);
    if (patch.llmProviderUid !== undefined) next.sa_llm_provider_uid = providerUid(patch.llmProviderUid);
    if (patch.projectOverride !== undefined) next.sa_project_model_override = patch.projectOverride === true;
    if (Object.keys(next).length) await tenant.update(next);
    return this.describe(tenantUid);
  }
}
