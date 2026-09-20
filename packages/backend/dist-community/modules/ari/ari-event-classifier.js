"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AI_VOICE_ARI_APP_NAME = void 0;
exports.resolveAiVoiceAriAppName = resolveAiVoiceAriAppName;
exports.classifyAriEvent = classifyAriEvent;
exports.assertChannelOwner = assertChannelOwner;
exports.DEFAULT_AI_VOICE_ARI_APP_NAME = 'krasterisk_ai_voice';
function resolveAiVoiceAriAppName(raw) {
    const name = (raw ?? process.env.ARI_AI_VOICE_APP_NAME ?? '').replace(/[^A-Za-z0-9_-]/g, '');
    return name || exports.DEFAULT_AI_VOICE_ARI_APP_NAME;
}
function classifyAriEvent(input) {
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
    const owner = input.application === input.names.aiVoice
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
function assertChannelOwner(event, expected) {
    if (!event.accepted || event.owner !== expected) {
        throw Object.assign(new Error('stale_owner'), { code: 'stale_owner', status: 403 });
    }
}
//# sourceMappingURL=ari-event-classifier.js.map