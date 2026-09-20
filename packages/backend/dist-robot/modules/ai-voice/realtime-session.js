"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_SIP_TRANSPORTS = void 0;
exports.createFakeVoiceModelSession = createFakeVoiceModelSession;
exports.certifySipProfile = certifySipProfile;
exports.assertSipReady = assertSipReady;
exports.evaluateSipProfile = evaluateSipProfile;
exports.invocationReplay = invocationReplay;
exports.hashInvocation = hashInvocation;
exports.newSipId = newSipId;
const node_crypto_1 = require("node:crypto");
const voice_engine_1 = require("./voice-engine");
function createFakeVoiceModelSession(log) {
    let open = false;
    return {
        async start(input) {
            open = true;
            log.push({ op: 'start', detail: `${input.sessionId}:${input.model}` });
        },
        async sendAudio(chunk) {
            if (!open)
                throw new voice_engine_1.DomainError('session_closed', 409);
            log.push({ op: 'audio', detail: String(chunk.length) });
        },
        async interrupt() {
            if (!open)
                throw new voice_engine_1.DomainError('session_closed', 409);
            log.push({ op: 'interrupt' });
        },
        async close(reason) {
            open = false;
            log.push({ op: 'close', detail: reason });
        },
    };
}
function certifySipProfile(input) {
    const certified = input.inviteOk && input.authRejectOk && input.hangupOk;
    return { transport: input.transport, srtp: input.transport === 'tls', certified };
}
function assertSipReady(input) {
    if (input.kind === 'external_sip' && !input.appliedRevision) {
        throw new voice_engine_1.DomainError('sip_not_certified', 409);
    }
}
exports.SUPPORTED_SIP_TRANSPORTS = ['udp', 'tcp', 'tls'];
function evaluateSipProfile(input) {
    if (input.nativePbx && !input.i4Evidence) {
        return { status: 'disabled', reason: 'native_pbx_gated', ready: false };
    }
    if (input.srtp && !input.certified) {
        return { status: 'disabled', reason: 'sip_profile_unsupported', ready: false };
    }
    if (input.transport === 'tls' && !input.certified) {
        return { status: 'disabled', reason: 'sip_profile_unsupported', ready: false };
    }
    if (!exports.SUPPORTED_SIP_TRANSPORTS.includes(input.transport)) {
        return { status: 'disabled', reason: 'sip_profile_unsupported', ready: false };
    }
    return { status: 'draft', reason: null, ready: false };
}
function invocationReplay(existingHash, requestHash) {
    if (!existingHash)
        return 'create';
    if (existingHash !== requestHash)
        throw new voice_engine_1.DomainError('invocation_conflict', 409);
    return 'replay';
}
function hashInvocation(body) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(body)).digest('hex');
}
function newSipId() {
    return (0, node_crypto_1.randomUUID)();
}
//# sourceMappingURL=realtime-session.js.map