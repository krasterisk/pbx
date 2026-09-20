import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from './voice-engine';

export type VoiceModelSession = {
  start(input: { sessionId: string; model: string }): Promise<void>;
  sendAudio(chunk: Buffer): Promise<void>;
  interrupt(): Promise<void>;
  close(reason: string): Promise<void>;
};

export type FakeVoiceCalls = Array<{ op: string; detail?: string }>;

export function createFakeVoiceModelSession(log: FakeVoiceCalls): VoiceModelSession {
  let open = false;
  return {
    async start(input) {
      open = true;
      log.push({ op: 'start', detail: `${input.sessionId}:${input.model}` });
    },
    async sendAudio(chunk) {
      if (!open) throw new DomainError('session_closed', 409);
      log.push({ op: 'audio', detail: String(chunk.length) });
    },
    async interrupt() {
      if (!open) throw new DomainError('session_closed', 409);
      log.push({ op: 'interrupt' });
    },
    async close(reason) {
      open = false;
      log.push({ op: 'close', detail: reason });
    },
  };
}

export type SipLabProfile = {
  transport: 'udp' | 'tcp' | 'tls';
  srtp: boolean;
  certified: boolean;
};

export function certifySipProfile(input: {
  transport: 'udp' | 'tcp' | 'tls';
  inviteOk: boolean;
  authRejectOk: boolean;
  hangupOk: boolean;
}): SipLabProfile {
  const certified = input.inviteOk && input.authRejectOk && input.hangupOk;
  return { transport: input.transport, srtp: input.transport === 'tls', certified };
}

export function assertSipReady(input: { kind: string; appliedRevision: boolean }): void {
  if (input.kind === 'external_sip' && !input.appliedRevision) {
    throw new DomainError('sip_not_certified', 409);
  }
}

export function invocationReplay(existingHash: string | null, requestHash: string): 'create' | 'replay' {
  if (!existingHash) return 'create';
  if (existingHash !== requestHash) throw new DomainError('invocation_conflict', 409);
  return 'replay';
}

export function hashInvocation(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export function newSipId(): string {
  return randomUUID();
}
