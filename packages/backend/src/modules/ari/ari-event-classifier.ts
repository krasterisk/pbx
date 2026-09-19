export const DEFAULT_AI_VOICE_ARI_APP_NAME = 'krasterisk_ai_voice';

export type AriOwnerKind = 'scripted' | 'autodial' | 'ai_voice' | 'unknown';

export type ClassifiedAriEvent = {
  owner: AriOwnerKind;
  app: string;
  channelKind: 'ordinary' | 'external-media' | 'snoop' | 'unknown';
  accepted: boolean;
  reason: string;
};

export function resolveAiVoiceAriAppName(raw?: string | null): string {
  const name = (raw ?? process.env.ARI_AI_VOICE_APP_NAME ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  return name || DEFAULT_AI_VOICE_ARI_APP_NAME;
}

export function classifyAriEvent(input: {
  application: string;
  names: { scriptedVoiceRobots: string; autodial: string; aiVoice: string };
  channelName?: string;
  applicationReplaced?: boolean;
  connected?: boolean;
}): ClassifiedAriEvent {
  if (input.applicationReplaced) {
    return {
      owner: 'unknown', app: input.application, channelKind: 'unknown',
      accepted: false, reason: 'application_replaced',
    };
  }
  const channelKind = /UnicastRTP|externalMedia/i.test(input.channelName ?? '')
    ? 'external-media'
    : /Snoop/i.test(input.channelName ?? '')
      ? 'snoop'
      : 'ordinary';
  const owner: AriOwnerKind = input.application === input.names.aiVoice
    ? 'ai_voice'
    : input.application === input.names.autodial
      ? 'autodial'
      : input.application === input.names.scriptedVoiceRobots
        ? 'scripted'
        : 'unknown';
  if (owner === 'unknown') {
    return { owner, app: input.application, channelKind, accepted: false, reason: 'foreign_app' };
  }
  if (input.connected === false) {
    return { owner, app: input.application, channelKind, accepted: false, reason: 'not_ready' };
  }
  return { owner, app: input.application, channelKind, accepted: true, reason: 'ok' };
}

export function assertChannelOwner(event: ClassifiedAriEvent, expected: AriOwnerKind): void {
  if (!event.accepted || event.owner !== expected) {
    throw Object.assign(new Error('stale_owner'), { code: 'stale_owner', status: 403 });
  }
}
