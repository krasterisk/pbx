export type SpeechProviderChoice = {
  sttProviderUid: number | null;
  llmProviderUid: number | null;
};

function pick(project: number | null, tenant: number | null, platform: number | null, projectOverride: boolean, ownModels: boolean): number | null {
  if (ownModels && projectOverride && project) return project;
  if (ownModels && tenant) return tenant;
  return platform;
}

/**
 * Lowest priority is the platform assignment. A tenant's own models replace it
 * when that cabinet is allowed to use them. A project value replaces the tenant
 * only when project override is on and the project actually stores a provider.
 */
export function resolveSpeechProviders(input: {
  ownModels: boolean;
  projectOverride: boolean;
  project: SpeechProviderChoice;
  tenant: SpeechProviderChoice;
  platform: SpeechProviderChoice;
}): SpeechProviderChoice {
  return {
    sttProviderUid: pick(
      input.project.sttProviderUid,
      input.tenant.sttProviderUid,
      input.platform.sttProviderUid,
      input.projectOverride,
      input.ownModels,
    ),
    llmProviderUid: pick(
      input.project.llmProviderUid,
      input.tenant.llmProviderUid,
      input.platform.llmProviderUid,
      input.projectOverride,
      input.ownModels,
    ),
  };
}

export function providerUid(value: unknown): number | null {
  const uid = Number(value);
  return Number.isInteger(uid) && uid > 0 ? uid : null;
}
