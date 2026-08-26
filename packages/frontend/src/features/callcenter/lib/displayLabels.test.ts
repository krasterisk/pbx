import { describe, it, expect } from 'vitest';
import {
  agentDisplayName,
  agentLabelWithExt,
  queueDisplayName,
  callerDisplayLabel,
  isRawAgentName,
  operatorChoiceLabel,
  agentStatusLabel,
  agentStatusColorFamily,
  coworkerActivityLabel,
  formatPauseReason,
  AGENT_STATUS_LABEL_KEYS,
  AGENT_STATUS_COLOR_FAMILY,
  formatStatusElapsed,
} from './displayLabels';
import type { AgentStatus } from '../model/types/callCenterSchema';

const identityT = (key: string, fallback?: string) => fallback ?? key;

describe('displayLabels', () => {
  it('detects raw PJSIP names', () => {
    expect(isRawAgentName('PJSIP/ew112_0', 'PJSIP/ew112_0')).toBe(true);
    expect(isRawAgentName('Alice', 'PJSIP/ew112_0')).toBe(false);
    expect(isRawAgentName('112', 'PJSIP/ew112_0')).toBe(true);
    expect(isRawAgentName('201', 'PJSIP/e201_0')).toBe(true);
  });

  it('agentDisplayName prefers human name, else extension', () => {
    expect(agentDisplayName({ name: 'Alice', interface: 'PJSIP/ew112_0' })).toBe('Alice');
    expect(agentDisplayName({ name: 'PJSIP/ew112_0', interface: 'PJSIP/ew112_0' })).toBe('112');
    expect(agentDisplayName({ name: '201', interface: 'PJSIP/e201_0' })).toBe('201');
  });

    it('agentLabelWithExt appends normalized extension', () => {
    expect(agentLabelWithExt({ name: 'Alice', interface: 'PJSIP/e201_0' })).toBe('Alice (201)');
    expect(agentLabelWithExt({ name: 'PJSIP/e201_0', interface: 'PJSIP/e201_0' })).toBe('201');
    expect(agentLabelWithExt({ name: 'Alice (201)', interface: 'PJSIP/e201_0' })).toBe('Alice (201)');
    expect(agentLabelWithExt({ name: 'Alice', interface: 'user:42' })).toBe('Alice');
  });

  it('operatorChoiceLabel prefers human name over PJSIP/extension', () => {
    expect(operatorChoiceLabel('201', [
      { name: 'PJSIP/e201_0', interface: 'PJSIP/e201_0' },
      { name: '201', interface: 'PJSIP/e201_0' },
      { name: 'Иван', interface: 'PJSIP/e201_0' },
    ])).toBe('Иван (201)');
    expect(operatorChoiceLabel('201', [
      { name: 'PJSIP/e201_0', interface: 'PJSIP/e201_0' },
    ])).toBe('201');
  });

  it('queueDisplayName formats as Name (number)', () => {
    expect(
      queueDisplayName('q700_0', [{ name: 'q700_0', displayName: 'Очередь продаж' }]),
    ).toBe('Очередь продаж (700)');
    expect(queueDisplayName('q700_0', [])).toBe('700');
    expect(
      queueDisplayName('sales_7', [{ name: 'sales_7', displayName: 'Sales' }]),
    ).toBe('Sales');
  });

  it('callerDisplayLabel formats name + number', () => {
    expect(callerDisplayLabel('201', 'Bob')).toBe('Bob (201)');
    expect(callerDisplayLabel('201', '')).toBe('201');
    expect(callerDisplayLabel('', '')).toBe('-');
  });

  describe('agentStatusLabel / agentStatusColorFamily (D-13/D-44)', () => {
    const ALL_STATUSES: AgentStatus[] = [
      'OFFLINE',
      'READY',
      'IN_CALL',
      'RINGING',
      'PAUSED',
      'WRAPUP',
      'DIALING',
      'CONSULT',
      'ACW',
    ];

    it('covers all 9 statuses with a label key and a color family', () => {
      for (const status of ALL_STATUSES) {
        expect(AGENT_STATUS_LABEL_KEYS[status]).toBeDefined();
        expect(AGENT_STATUS_COLOR_FAMILY[status]).toBeDefined();
      }
    });

    it('relabels READY to the "Waiting for call" copy (D-13), not "Ready"', () => {
      expect(agentStatusLabel('READY', identityT)).toBe('Waiting for call');
      expect(AGENT_STATUS_LABEL_KEYS.READY.key).toBe('callcenter.status.ready');
    });

    it('maps OFFLINE to callcenter.status.offline key', () => {
      expect(AGENT_STATUS_LABEL_KEYS.OFFLINE.key).toBe('callcenter.status.offline');
      expect(agentStatusLabel('OFFLINE', identityT)).toBe('Offline');
    });

    it('resolves labels + i18n keys for the three new statuses', () => {
      expect(agentStatusLabel('DIALING', identityT)).toBe('Dialing');
      expect(AGENT_STATUS_LABEL_KEYS.DIALING.key).toBe('callcenter.status.dialing');
      expect(agentStatusLabel('CONSULT', identityT)).toBe('Consulting');
      expect(AGENT_STATUS_LABEL_KEYS.CONSULT.key).toBe('callcenter.status.consult');
      expect(agentStatusLabel('ACW', identityT)).toBe('After-call work');
      expect(AGENT_STATUS_LABEL_KEYS.ACW.key).toBe('callcenter.status.acw');
    });

    it('maps IN_CALL/RINGING/DIALING to the destructive-tint busy family', () => {
      expect(agentStatusColorFamily('IN_CALL')).toBe('destructive');
      expect(agentStatusColorFamily('RINGING')).toBe('destructive');
      expect(agentStatusColorFamily('DIALING')).toBe('destructive');
    });

    it('maps WRAPUP/ACW/CONSULT to the info family (no 6th color)', () => {
      expect(agentStatusColorFamily('WRAPUP')).toBe('info');
      expect(agentStatusColorFamily('ACW')).toBe('info');
      expect(agentStatusColorFamily('CONSULT')).toBe('info');
    });

    it('maps READY to success and PAUSED to warning', () => {
      expect(agentStatusColorFamily('READY')).toBe('success');
      expect(agentStatusColorFamily('PAUSED')).toBe('warning');
    });

    it('maps OUTBOUND_WORK to info (available, not busy-red)', () => {
      expect(agentStatusColorFamily('OUTBOUND_WORK')).toBe('info');
    });

    it('falls back to muted for an unrecognized status value', () => {
      expect(agentStatusColorFamily('BOGUS' as AgentStatus)).toBe('muted');
    });
  });

  describe('formatPauseReason', () => {
    it('localizes RONA / auto_pause:rona codes', () => {
      expect(formatPauseReason('auto_pause:rona', identityT)).toBe('Auto-pause: no answer');
      expect(formatPauseReason('RONA (ring-no-answer)', identityT)).toBe('Auto-pause: no answer');
    });

    it('localizes missed / idle / status auto-pause codes', () => {
      expect(formatPauseReason('auto_pause:missed:3', identityT)).toBe('Auto-pause: 3 missed');
      expect(formatPauseReason('auto_pause:idle:60', identityT)).toBe('Auto-pause: idle 60s');
      expect(formatPauseReason('auto_pause:status:WRAPUP:30', identityT)).toContain('Wrap-up');
    });

    it('passes through catalog pause reasons', () => {
      expect(formatPauseReason('Lunch', identityT)).toBe('Lunch');
    });
  });

  describe('coworkerActivityLabel', () => {
    it('formats queue ring as Calling · queue name (caller)', () => {
      const result = coworkerActivityLabel(
        { status: 'RINGING' },
        { queue: 'q700_0', callerIdNum: '201' },
        [{ name: 'q700_0', displayName: 'Sales' }],
        identityT,
      );
      expect(result.tone).toBe('warning');
      expect(result.text).toContain('Calling');
      expect(result.text).toContain('Sales (700)');
      expect(result.text).toContain('201');
    });

    it('formats outbound dial and talking with success tone', () => {
      const dialing = coworkerActivityLabel(
        { status: 'DIALING', dialTarget: '79001234567' },
        undefined,
        [],
        identityT,
      );
      expect(dialing.tone).toBe('warning');
      expect(dialing.text).toContain('Outbound');
      expect(dialing.text).toContain('79001234567');

      const talking = coworkerActivityLabel(
        { status: 'IN_CALL' },
        { queue: 'q700_0', callerIdNum: '201' },
        [{ name: 'q700_0', displayName: 'Sales' }],
        identityT,
      );
      expect(talking.tone).toBe('success');
      expect(talking.text).toContain('Talking');
      expect(talking.text).toContain('201');
    });

    it('formats personal inbound via peerNumber (no CallState)', () => {
      const ringing = coworkerActivityLabel(
        { status: 'RINGING', peerNumber: '201' },
        undefined,
        [],
        identityT,
      );
      expect(ringing.text).toContain('Calling');
      expect(ringing.text).toContain('Personal');
      expect(ringing.text).toContain('201');
      expect(ringing.text).not.toContain('Outbound');

      const talking = coworkerActivityLabel(
        { status: 'IN_CALL', peerNumber: '201' },
        undefined,
        [],
        identityT,
      );
      expect(talking.text).toContain('Talking');
      expect(talking.text).toContain('Personal');
      expect(talking.text).toContain('201');
    });

    it('does not treat bare DIALING without dialTarget as outbound when peerNumber is set', () => {
      const result = coworkerActivityLabel(
        { status: 'DIALING', peerNumber: '201' },
        undefined,
        [],
        identityT,
      );
      expect(result.text).toContain('Personal');
      expect(result.text).toContain('201');
      expect(result.text).not.toContain('Outbound');
    });
  });

  describe('formatStatusElapsed', () => {
    it('formats under one hour as mm:ss', () => {
      expect(formatStatusElapsed(0)).toBe('00:00');
      expect(formatStatusElapsed(65)).toBe('01:05');
      expect(formatStatusElapsed(59 * 60 + 59)).toBe('59:59');
    });

    it('formats one hour and above as h:mm:ss', () => {
      expect(formatStatusElapsed(3600)).toBe('1:00:00');
      expect(formatStatusElapsed(977 * 60 + 13)).toBe('16:17:13');
      expect(formatStatusElapsed(40 * 3600 + 17 * 60 + 13)).toBe('40:17:13');
    });
  });
});
