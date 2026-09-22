import * as fs from 'fs';
import * as path from 'path';
import {
  invokeSaChargeRun,
  saChargeRunOperationKey,
} from './sa-charge-run';

const seamSource = fs.readFileSync(path.join(__dirname, 'sa-charge-run.ts'), 'utf8');

describe('SA-CHARGE-RUN persist seam (D-46)', () => {
  it('derives the future operation key from the run id only', () => {
    expect(saChargeRunOperationKey('run-abc-123')).toBe('run-abc-123');
  });

  it('writes amount 0 with charged=false when speech_analytics rates are missing', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const result = await invokeSaChargeRun(
      {
        runId: 'run-missing-rates',
        tenantUid: 42,
        audioMs: 15_000,
        providerTokens: 200,
        currency: 'RUB',
      },
      {
        findLatestRates: async () => [],
        updateRun: async (_runId, _tenantUid, patch) => {
          updates.push(patch);
        },
      },
    );

    expect(result).toEqual({ amount: '0', currency: 'RUB', charged: false });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      amount: '0',
      currency: 'RUB',
      audio_ms: '15000',
      provider_tokens: '200',
      charged: false,
    });
  });

  it('still invokes the persist path when calculated parts sum to 0', async () => {
    const updateRun = jest.fn(async () => undefined);
    const result = await invokeSaChargeRun(
      {
        runId: 'run-zero-sum',
        tenantUid: 7,
        audioMs: 0,
        providerTokens: 0,
        currency: 'RUB',
      },
      {
        findLatestRates: async () => [
          { unit: 'audio_ms', rate: '0.01', currency: 'RUB', scale: 2 },
          { unit: 'provider_tokens', rate: '0.001', currency: 'RUB', scale: 2 },
        ],
        updateRun,
      },
    );

    expect(result.amount).toBe('0.00');
    expect(result.charged).toBe(false);
    expect(updateRun).toHaveBeenCalledTimes(1);
    expect(updateRun).toHaveBeenCalledWith(
      'run-zero-sum',
      7,
      expect.objectContaining({ amount: '0.00', charged: false }),
    );
  });

  it('never imports settleShadow or BillingBalanceService from the seam module', () => {
    expect(seamSource).not.toMatch(/settleShadow/);
    expect(seamSource).not.toMatch(/BillingBalanceService/);
    expect(seamSource).not.toMatch(/shadow-settlement/);
    expect(seamSource).not.toMatch(/billing-balance\.service/);
  });
});
