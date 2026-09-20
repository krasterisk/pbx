import { createEmulatedWallet, settleEmulatedWallet } from './emulated-wallet';
import { disabledWallet } from './shadow-settlement';

describe('emulated wallet', () => {
  it('debits kopecks idempotently and never uses the live billing probe', () => {
    const wallet = createEmulatedWallet(1_000);
    const first = settleEmulatedWallet({
      tenantUid: 8, reservationId: 'res-1', actualUnits: 2, rate: '1.25', scale: 2, wallet,
    });
    expect(first).toMatchObject({ charged: true, emulated: true, liveBilling: false, amount: '2.50' });
    expect(wallet.balanceKopecks).toBe(750);
    const replay = settleEmulatedWallet({
      tenantUid: 8, reservationId: 'res-1', actualUnits: 2, rate: '1.25', scale: 2, wallet,
    });
    expect(replay.replay).toBe(true);
    expect(wallet.balanceKopecks).toBe(750);
    const live = disabledWallet();
    expect(() => settleEmulatedWallet({
      tenantUid: 8, reservationId: 'res-2', actualUnits: 1, rate: '1.00', scale: 2,
      wallet: live as never,
    })).toThrow(/live_wallet_denied/);
    expect(live.chargeCalls).toBe(0);
  });
});
