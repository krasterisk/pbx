import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyFontTrial,
  FONT_TRIAL_KEY,
  FONT_TRIALS,
  EXTRA_FONT_TRIALS,
  readFontTrial,
  setFontTrial,
} from './fontTrial';
beforeEach(() => {
  sessionStorage.clear();
  document.documentElement.style.removeProperty('--font-sans');
});
describe('global reversible font trial', () => {
  it('offers the aiPBX pair and ten additional unique font trials', () => {
    expect(EXTRA_FONT_TRIALS).toHaveLength(11);
    expect(new Set(EXTRA_FONT_TRIALS.map(([id]) => id)).size).toBe(11);
    for (const [id] of EXTRA_FONT_TRIALS) expect(FONT_TRIALS[id]).toBeTruthy();
  });
  it('changes one global token, persists across navigation/reload and restores the default', () => {
    setFontTrial('arial');
    expect(readFontTrial()).toBe('arial');
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe(
      FONT_TRIALS.arial,
    );
    document.documentElement.style.removeProperty('--font-sans');
    applyFontTrial();
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe(
      FONT_TRIALS.arial,
    );
    setFontTrial('inter');
    expect(sessionStorage.getItem(FONT_TRIAL_KEY)).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe(
      '',
    );
  });
  it('loads the aiPBX pair lazily and supplies separate heading/body tokens', () => {
    setFontTrial('aipbx');
    expect(
      document.documentElement.style.getPropertyValue('--font-heading'),
    ).toContain('Roboto');
    expect(
      document.getElementById('font-trial-aipbx')?.getAttribute('href'),
    ).toContain('Nunito+Sans');
    setFontTrial('golos');
    expect(
      document.documentElement.style.getPropertyValue('--font-heading'),
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--font-sans'),
    ).toContain('Golos Text');
  });
  it('ignores invalid stored values', () => {
    sessionStorage.setItem(FONT_TRIAL_KEY, 'constructor');
    expect(readFontTrial()).toBe('inter');
  });
});
