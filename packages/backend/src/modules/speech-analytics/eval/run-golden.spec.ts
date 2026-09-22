import * as fs from 'fs';
import * as path from 'path';
import {
  loadGoldenSet,
  runGoldenEval,
  type PredictedScores,
} from './run-golden';

const CLINIC_RE = /клиник|терапевт|кардиолог|стоматолог|офтальмолог|поликлиник|врач/i;

describe('run-golden delivery check (D-43, D-44, D-45)', () => {
  const fixtures = loadGoldenSet();

  it('loads three universal fixtures without clinic wording and keeps example-003 expert scores', () => {
    expect(fixtures).toHaveLength(3);
    const ids = fixtures.map((c) => c.id).sort();
    expect(ids).toEqual([
      'example-001-resolved',
      'example-002-replacement-accepted',
      'example-003-out-of-scope-service',
    ].sort());

    for (const c of fixtures) {
      expect(c.transcript.trim().length).toBeGreaterThan(0);
      expect(CLINIC_RE.test(c.transcript)).toBe(false);
      expect(CLINIC_RE.test(c.description ?? '')).toBe(false);
      expect((c.reference as { custom_metrics?: unknown }).custom_metrics).toBeUndefined();
    }

    const ex3 = fixtures.find((c) => c.id === 'example-003-out-of-scope-service')!;
    expect(ex3.reference.success).toBe(true);
    expect(ex3.reference.problem_resolution).toBe(100);
    expect(ex3.reference.product_knowledge).toBe(100);
  });

  it('fails the check when the model does not answer or the answer is empty', async () => {
    const createJournalRow = jest.fn();
    const invokeSaChargeRun = jest.fn();
    const result = await runGoldenEval(fixtures.slice(0, 1), {
      scoreCase: async () => null,
      createJournalRow,
      invokeSaChargeRun,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.failures).toBeGreaterThan(0);
    expect(createJournalRow).not.toHaveBeenCalled();
    expect(invokeSaChargeRun).not.toHaveBeenCalled();
    expect(result.journalWrites).toBe(0);
    expect(result.chargeInvokes).toBe(0);
  });

  it('prints MAE/accuracy/kappa style drift but does not fail delivery when answers are present', async () => {
    const drifted: PredictedScores = {
      greeting_quality: 50,
      script_compliance: 50,
      politeness_empathy: 50,
      active_listening: 50,
      objection_handling: 50,
      product_knowledge: 50,
      problem_resolution: 50,
      speech_clarity_pace: 50,
      closing_quality: 50,
      csat: 2,
      customer_sentiment: 'Negative',
      success: false,
      summary: 'drifted scores present',
    };

    const createJournalRow = jest.fn();
    const invokeSaChargeRun = jest.fn();
    const result = await runGoldenEval(fixtures, {
      scoreCase: async () => drifted,
      createJournalRow,
      invokeSaChargeRun,
    });

    expect(result.exitCode).toBe(0);
    expect(result.failures).toBe(0);
    expect(result.report.overallMae).not.toBeNull();
    expect(result.report.numeric.length).toBeGreaterThan(0);
    expect(result.report.categorical.length).toBeGreaterThan(0);
    expect(createJournalRow).not.toHaveBeenCalled();
    expect(invokeSaChargeRun).not.toHaveBeenCalled();
  });

  it('registers eval:speech-analytics outside ordinary npm test', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts['eval:speech-analytics']).toMatch(/run-golden/);
    expect(pkg.scripts.test).not.toMatch(/eval:speech-analytics|run-golden/);
  });
});
