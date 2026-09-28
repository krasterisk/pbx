import { resolveSpeechProviders } from './speech-provider-resolve';

const empty = { sttProviderUid: null, llmProviderUid: null };

describe('resolveSpeechProviders', () => {
  const platform = { sttProviderUid: 1, llmProviderUid: 2 };
  const tenant = { sttProviderUid: 3, llmProviderUid: 4 };
  const project = { sttProviderUid: 5, llmProviderUid: 6 };

  it('uses the platform assignment when the cabinet does not use its own models', () => {
    expect(resolveSpeechProviders({
      ownModels: false,
      projectOverride: true,
      project,
      tenant,
      platform,
    })).toEqual(platform);
  });

  it('uses tenant models over the platform when own models are on', () => {
    expect(resolveSpeechProviders({
      ownModels: true,
      projectOverride: false,
      project,
      tenant,
      platform,
    })).toEqual(tenant);
  });

  it('uses project models over the tenant when override is on and they are set', () => {
    expect(resolveSpeechProviders({
      ownModels: true,
      projectOverride: true,
      project,
      tenant,
      platform,
    })).toEqual(project);
  });

  it('falls through an empty project or tenant slot to the next level', () => {
    expect(resolveSpeechProviders({
      ownModels: true,
      projectOverride: true,
      project: { sttProviderUid: 5, llmProviderUid: null },
      tenant: { sttProviderUid: null, llmProviderUid: 4 },
      platform,
    })).toEqual({ sttProviderUid: 5, llmProviderUid: 4 });
    expect(resolveSpeechProviders({
      ownModels: true,
      projectOverride: true,
      project: empty,
      tenant: empty,
      platform,
    })).toEqual(platform);
  });
});
