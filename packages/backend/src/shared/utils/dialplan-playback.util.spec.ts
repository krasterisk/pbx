import { DIALPLAN_ACTION_META } from '@krasterisk/shared';
import { AsteriskDialplanUtils, findUnreachableSteps } from './dialplan.util';
import { emitPlayback } from './dialplan-playback.util';

const CTX = { vpbxUserUid: 42 };

describe('emitPlayback (D-51 / D-52 / D-53)', () => {
  it('plain mode emits Playback( and never BackGround(', () => {
    const out = emitPlayback({ files: 'welcome', mode: 'plain' }, CTX);
    expect(out).toContain('Playback(');
    expect(out).not.toContain('BackGround(');
    expect(out).not.toContain('Background(');
    expect(out).not.toContain('ControlPlayback(');
  });

  it('control mode emits ControlPlayback(', () => {
    const out = emitPlayback({ files: 'welcome', mode: 'control' }, CTX);
    expect(out).toContain('ControlPlayback(');
    expect(out).not.toMatch(/(?:^|[^a-zA-Z])Playback\(/);
    expect(out).not.toContain('BackGround(');
  });

  it('menu mode emits BackGround(', () => {
    const out = emitPlayback({ files: 'menu', mode: 'menu' }, CTX);
    expect(out).toContain('BackGround(');
    expect(out).not.toContain('Playback(');
    expect(out).not.toContain('ControlPlayback(');
  });

  it('plain mode with language emits Set(CHANNEL(language)=ru) before the app', () => {
    const out = emitPlayback({ files: 'welcome', mode: 'plain', langoverride: 'ru' }, CTX);
    expect(out).toContain('Set(CHANNEL(language)=ru)');
    expect(out.indexOf('Set(CHANNEL(language)=ru)')).toBeLessThan(out.indexOf('Playback('));
  });

  it('control mode with language emits Set(CHANNEL(language)=) and not a BackGround langoverride', () => {
    const out = emitPlayback({ files: 'welcome', mode: 'control', langoverride: 'en' }, CTX);
    expect(out).toContain('Set(CHANNEL(language)=en)');
    expect(out).not.toMatch(/ControlPlayback\([^)]*,en/);
  });

  it('menu mode with language uses BackGround langoverride and does not Set(CHANNEL(language)=', () => {
    const out = emitPlayback({ files: 'menu', mode: 'menu', langoverride: 'ru' }, CTX);
    expect(out).toContain('BackGround(');
    expect(out).toContain('ru');
    expect(out).toMatch(/BackGround\([^)]*ru/);
    expect(out).not.toContain('Set(CHANNEL(language)=');
  });

  it('noanswer emits Progress() before the application in every mode', () => {
    for (const mode of ['plain', 'control', 'menu'] as const) {
      const out = emitPlayback({
        files: 'welcome',
        mode,
        options: { noanswer: true },
      }, CTX);
      expect(out).toContain('Progress()');
      const appName = mode === 'plain' ? 'Playback(' : mode === 'control' ? 'ControlPlayback(' : 'BackGround(';
      expect(out.indexOf('Progress()')).toBeLessThan(out.indexOf(appName));
    }
  });

  it('without noanswer does not emit Progress()', () => {
    const out = emitPlayback({ files: 'welcome', mode: 'plain' }, CTX);
    expect(out).not.toContain('Progress()');
  });

  it('Progress() comes before language Set, which comes before the app', () => {
    const out = emitPlayback({
      files: 'welcome',
      mode: 'plain',
      langoverride: 'ru',
      options: { noanswer: true },
    }, CTX);
    const iProgress = out.indexOf('Progress()');
    const iLang = out.indexOf('Set(CHANNEL(language)=ru)');
    const iApp = out.indexOf('Playback(');
    expect(iProgress).toBeGreaterThanOrEqual(0);
    expect(iLang).toBeGreaterThan(iProgress);
    expect(iApp).toBeGreaterThan(iLang);
  });

  it('sanitizes file path traversal before emitting the app argument', () => {
    const out = emitPlayback({ files: '../etc/passwd', mode: 'plain' }, CTX);
    expect(out).toContain('Playback(/usr/records/42/sounds/etcpasswd)');
    expect(out).not.toContain('..');
    expect(out).not.toContain('/etc/');
  });
});

describe('D-53 playback terminal meta', () => {
  it('marks unified playback as conditional and does not cut the tail', () => {
    expect(DIALPLAN_ACTION_META.playback.terminal).toBe('conditional');
    const playbackMenu = { type: 'playback', params: { files: 'menu', mode: 'menu' } };
    const setvar = { type: 'setclid_custom', params: { callerid: '1' } };
    expect(findUnreachableSteps([playbackMenu, setvar])).toEqual([]);
  });
});

describe('actionToDialplan dual-read + unified playback', () => {
  it('legacy playprompt still emits the 12-01 Playback baseline', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      { type: 'playprompt', params: { file: 'welcome' }, condition: {} },
      42,
    );
    expect(dp).toBe('Playback(/usr/records/42/sounds/welcome)');
  });

  it('legacy playback without mode still emits the 12-01 Background baseline', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      { type: 'playback', params: { file: 'menu' }, condition: {} },
      42,
    );
    expect(dp).toBe('Background(/usr/records/42/sounds/menu)');
  });

  it('playback with mode:plain routes through emitPlayback', () => {
    const dp = AsteriskDialplanUtils.actionToDialplan(
      { type: 'playback', params: { files: 'welcome', mode: 'plain' }, condition: {} },
      42,
    );
    expect(dp).toContain('Playback(');
    expect(dp).not.toContain('BackGround(');
    expect(dp).not.toContain('Background(');
  });
});
