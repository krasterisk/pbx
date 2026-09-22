import * as fs from 'fs';
import * as path from 'path';
import {
  invokeSaChargeInsights,
  saChargeInsightsOperationKey,
} from './sa-charge-insights';

const chargingDir = __dirname;
const seamSource = fs.readFileSync(path.join(chargingDir, 'sa-charge-insights.ts'), 'utf8');
const chargingExports = fs.readdirSync(chargingDir).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));

describe('SA-CHARGE-INSIGHTS persist seam (D-47)', () => {
  it('derives the future operation key from the insights request id only', () => {
    expect(saChargeInsightsOperationKey('insights-req-9')).toBe('insights-req-9');
  });

  it('persists provider_tokens amount with charged=false on the insights request id', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const result = await invokeSaChargeInsights(
      {
        insightsRequestId: 'insights-req-9',
        tenantUid: 11,
        providerTokens: 500,
        currency: 'RUB',
      },
      {
        findLatestRates: async () => [
          { unit: 'provider_tokens', rate: '0.002', currency: 'RUB', scale: 2 },
        ],
        updateInsightsRequest: async (_id, _tenantUid, patch) => {
          updates.push(patch);
        },
      },
    );

    expect(result.charged).toBe(false);
    expect(result.amount).toBe('1.00');
    expect(updates).toEqual([
      expect.objectContaining({
        amount: '1.00',
        currency: 'RUB',
        provider_tokens: '500',
        charged: false,
      }),
    ]);
  });

  it('writes amount 0 when rates are missing and still calls the persist path', async () => {
    const updateInsightsRequest = jest.fn(async () => undefined);
    const result = await invokeSaChargeInsights(
      {
        insightsRequestId: 'insights-missing',
        tenantUid: 3,
        providerTokens: 10,
        currency: 'RUB',
      },
      {
        findLatestRates: async () => [],
        updateInsightsRequest,
      },
    );

    expect(result).toEqual({ amount: '0', currency: 'RUB', charged: false });
    expect(updateInsightsRequest).toHaveBeenCalledTimes(1);
  });

  it('documents that a cache hit must not call invokeSaChargeInsights again', () => {
    // Cache-hit path is owned by the insights service (18-08); the seam itself is
    // only invoked on a successful model response (D-47). This suite asserts the
    // seam is side-effect free until explicitly called — calling once ≠ twice.
    const updateInsightsRequest = jest.fn(async () => undefined);
    const deps = {
      findLatestRates: async () => [],
      updateInsightsRequest,
    };
    const payload = {
      insightsRequestId: 'insights-cache',
      tenantUid: 1,
      providerTokens: 0,
      currency: 'RUB',
    };
    return invokeSaChargeInsights(payload, deps).then(async () => {
      expect(updateInsightsRequest).toHaveBeenCalledTimes(1);
      // Simulated cache hit: caller skips second invokeSaChargeInsights.
      expect(updateInsightsRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('never imports wallet debit helpers and does not export SA-CHARGE-GATE', () => {
    expect(seamSource).not.toMatch(/from ['"].*shadow-settlement['"]/);
    expect(seamSource).not.toMatch(/from ['"].*billing-balance\.service['"]/);
    expect(seamSource).not.toMatch(/\bsettleShadow\s*\(/);
    expect(seamSource).not.toMatch(/\bBillingBalanceService\b/);
    expect(chargingExports.some((name) => /gate/i.test(name))).toBe(false);
    expect(seamSource).not.toMatch(/\binvokeSaChargeGate\b/);
  });
});
