import { createPstnEmulator } from './pstn-emulator';
import { createEmulatedWallet } from '../ai-usage/emulated-wallet';

describe('local paid SIP emulator', () => {
  it('answers a lab number, bills the emulated wallet, and never egresses a real PSTN', () => {
    const wallet = createEmulatedWallet(1_000);
    const pstn = createPstnEmulator({
      wallet, cps: 2, pulseKopecks: 100, packetLossPct: 10, now: () => 1_000,
    });
    const first = pstn.dial({ tenantUid: 8, from: '+15555550100', to: '+15555550101' });
    expect(first.status).toBe('answered');
    expect(first.sipCode).toBe(200);
    expect(first.billedKopecks).toBe(100);
    expect(first.profile.transport).toBe('tls');
    expect(first.profile.srtp).toBe(true);
    expect(first.natLost).toBe(2);
    expect(wallet.balanceKopecks).toBe(900);
    expect(pstn.simulateWrongAuth().sipCode).toBe(403);
    expect(() => pstn.dial({ tenantUid: 8, from: '+15555550100', to: '+79001234567' }))
      .toThrow(/pstn_not_emulated/);
    const second = pstn.dial({ tenantUid: 8, from: '+15555550100', to: '+15555550102' });
    expect(second.status).toBe('answered');
    const third = pstn.dial({ tenantUid: 8, from: '+15555550100', to: '+15555550103' });
    expect(third.status).toBe('provider_429');
    expect(pstn.drain()).toEqual({ admissionsStopped: true, liveSip: false, emulatedPstn: true });
  });

  it('stops when the emulated budget cannot cover the pulse', () => {
    const pstn = createPstnEmulator({
      wallet: createEmulatedWallet(50), pulseKopecks: 100, now: () => 5,
    });
    expect(pstn.dial({ tenantUid: 8, from: '+15555550100', to: '+15555550101' }).status)
      .toBe('budget_exceeded');
  });
});
