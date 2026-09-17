import {
  autodialDialModeLabel,
  autodialDispositionLabel,
  autodialLimitedByLabel,
  autodialStatusLabel,
  autodialStatusTone,
  formatAutodialDuration,
} from './labels';

const t = (_key: string, fallback: string) => fallback;
const keyOnly = (key: string) => key;

describe('autodial labels', () => {
  it('reads a translation key with a Russian fallback', () => {
    expect(autodialStatusLabel('running', t)).toBe('Идёт набор');
    expect(autodialStatusLabel('running', keyOnly)).toBe('autodial.status.running');
  });

  it('names every dial mode', () => {
    expect(autodialDialModeLabel('power', t)).toBe('Power (N:1)');
    expect(autodialDialModeLabel('agentless', t)).toBe('Без операторов');
  });

  it('distinguishes a short answer from a success', () => {
    expect(autodialDispositionLabel('success', t)).toBe('Успешно');
    expect(autodialDispositionLabel('answered_short', t)).toBe('Короткий разговор');
  });

  it('explains why pacing is capped', () => {
    expect(autodialLimitedByLabel('queue_agents', t)).toBe('Свободные операторы');
    expect(autodialLimitedByLabel('queue_agents_warmup', t)).toBe(
      'Ожидание данных по операторам',
    );
  });

  it('falls back to the raw reason for an unknown limit', () => {
    expect(autodialLimitedByLabel('something_new', t)).toBe('something_new');
  });
});

describe('autodialStatusTone', () => {
  it('does not make a paused or stopped campaign look healthy', () => {
    expect(autodialStatusTone('running')).toBe('default');
    expect(autodialStatusTone('paused')).toBe('secondary');
    expect(autodialStatusTone('stopped')).toBe('destructive');
    expect(autodialStatusTone('draft')).toBe('outline');
  });
});

describe('formatAutodialDuration', () => {
  it('pads seconds to two digits', () => {
    expect(formatAutodialDuration(65)).toBe('1:05');
    expect(formatAutodialDuration(600)).toBe('10:00');
  });

  it('clamps nonsense input to zero', () => {
    expect(formatAutodialDuration(-5)).toBe('0:00');
  });
});
