import { DomainError } from './voice-engine';
import { createEmulatedWallet, type EmulatedWallet } from '../ai-usage/emulated-wallet';
import { certifySipProfile, type SipLabProfile } from './realtime-session';

const LAB_NUMBER = /^\+15555550\d{3}$/;

export type PstnDialInput = {
  tenantUid: number;
  from: string;
  to: string;
};

export type PstnDialResult = {
  status: 'answered' | 'auth_reject' | 'budget_exceeded' | 'provider_429' | 'not_emulated';
  sipCode: number;
  billedKopecks: number;
  natLost: number;
  profile: SipLabProfile;
};

export type PstnEmulator = {
  kind: 'local_emulator';
  wallet: EmulatedWallet;
  dial(input: PstnDialInput): PstnDialResult;
  simulateWrongAuth(): PstnDialResult;
  drain(): { admissionsStopped: true; liveSip: false; emulatedPstn: true };
};

export function createPstnEmulator(input: {
  budgetKopecks?: number;
  cps?: number;
  pulseKopecks?: number;
  packetLossPct?: number;
  wallet?: EmulatedWallet;
  now?: () => number;
}): PstnEmulator {
  const wallet = input.wallet ?? createEmulatedWallet(input.budgetKopecks ?? 10_000);
  const cps = input.cps ?? 2;
  const pulse = input.pulseKopecks ?? 100;
  const lossPct = input.packetLossPct ?? 5;
  const window: number[] = [];
  const tlsProfile = certifySipProfile({
    transport: 'tls', inviteOk: true, authRejectOk: true, hangupOk: true,
  });

  const natLost = (packets: number) => Math.floor(packets * lossPct / 100);

  return {
    kind: 'local_emulator',
    wallet,
    simulateWrongAuth() {
      return {
        status: 'auth_reject', sipCode: 403, billedKopecks: 0, natLost: 0, profile: tlsProfile,
      };
    },
    drain() {
      return { admissionsStopped: true, liveSip: false, emulatedPstn: true };
    },
    dial(call) {
      if (!LAB_NUMBER.test(call.to)) {
        throw new DomainError('pstn_not_emulated', 400);
      }
      const t = (input.now ?? Date.now)();
      window.push(t);
      while (window.length && t - window[0] > 1000) window.shift();
      if (window.length > cps) {
        return {
          status: 'provider_429', sipCode: 429, billedKopecks: 0, natLost: natLost(20), profile: tlsProfile,
        };
      }
      if (wallet.balanceKopecks < pulse) {
        return {
          status: 'budget_exceeded', sipCode: 402, billedKopecks: 0, natLost: 0, profile: tlsProfile,
        };
      }
      const charged = wallet.charge({
        tenantUid: call.tenantUid,
        operationKey: `pstn:${call.tenantUid}:${call.to}:${t}`,
        amountKopecks: pulse,
      });
      return {
        status: 'answered',
        sipCode: 200,
        billedKopecks: charged.amountKopecks,
        natLost: natLost(20),
        profile: tlsProfile,
      };
    },
  };
}
