import {
  canPanelOverrideAsteriskPause,
  isTrustedPanelPauseOrigin,
  type AgentStatusOrigin,
} from './status-origin';

describe('status-origin', () => {
  it('trusts manual / policy / login / restore only', () => {
    expect(isTrustedPanelPauseOrigin('manual')).toBe(true);
    expect(isTrustedPanelPauseOrigin('policy')).toBe(true);
    expect(isTrustedPanelPauseOrigin('login')).toBe(true);
    expect(isTrustedPanelPauseOrigin('restore')).toBe(true);
    expect(isTrustedPanelPauseOrigin('ami')).toBe(false);
    expect(isTrustedPanelPauseOrigin('unknown')).toBe(false);
    expect(isTrustedPanelPauseOrigin('call')).toBe(false);
    expect(isTrustedPanelPauseOrigin(undefined)).toBe(false);
  });

  it('allows panel override for manual PAUSED with reason', () => {
    expect(canPanelOverrideAsteriskPause({
      status: 'PAUSED',
      statusOrigin: 'manual',
      pauseReason: 'Обед',
    })).toBe(true);
  });

  it('rejects PAUSED without reason even if origin is manual', () => {
    expect(canPanelOverrideAsteriskPause({
      status: 'PAUSED',
      statusOrigin: 'manual',
      pauseReason: '',
    })).toBe(false);
  });

  it('allows READY from login / unpause', () => {
    expect(canPanelOverrideAsteriskPause({
      status: 'READY',
      statusOrigin: 'login',
    })).toBe(true);
    expect(canPanelOverrideAsteriskPause({
      status: 'READY',
      statusOrigin: 'manual',
    })).toBe(true);
  });

  it('rejects ami / unknown READY — must not force Asterisk', () => {
    expect(canPanelOverrideAsteriskPause({
      status: 'READY',
      statusOrigin: 'ami',
    })).toBe(false);
    expect(canPanelOverrideAsteriskPause({
      status: 'READY',
      statusOrigin: 'unknown',
    })).toBe(false);
  });

  it('falls back to trusted session snapshot when RAM origin is missing', () => {
    expect(canPanelOverrideAsteriskPause({
      status: 'PAUSED',
      statusOrigin: undefined,
      pauseReason: 'auto_pause:rona',
      sessionStatus: 'PAUSED',
      sessionStatusOrigin: 'policy',
    })).toBe(true);
  });

  it('rejects session fallback when snapshot status mismatches', () => {
    expect(canPanelOverrideAsteriskPause({
      status: 'READY',
      statusOrigin: 'ami',
      sessionStatus: 'PAUSED',
      sessionStatusOrigin: 'manual' as AgentStatusOrigin,
    })).toBe(false);
  });
});
