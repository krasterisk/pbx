import { describe, it, expect } from 'vitest';
import {
  agentDisplayName,
  queueDisplayName,
  callerDisplayLabel,
  isRawAgentName,
  agentStatusLabel,
  agentStatusColorFamily,
  AGENT_STATUS_LABEL_KEYS,
  AGENT_STATUS_COLOR_FAMILY,
} from './displayLabels';
import type { AgentStatus } from '../model/types/callCenterSchema';

const identityT = (key: string, fallback?: string) => fallback ?? key;

describe('displayLabels', () => {
  it('detects raw PJSIP names', () => {
    expect(isRawAgentName('PJSIP/ew112_0', 'PJSIP/ew112_0')).toBe(true);
    expect(isRawAgentName('Alice', 'PJSIP/ew112_0')).toBe(false);
  });

  it('agentDisplayName prefers human name, else extension', () => {
    expect(agentDisplayName({ name: 'Alice', interface: 'PJSIP/ew112_0' })).toBe('Alice');
    expect(agentDisplayName({ name: 'PJSIP/ew112_0', interface: 'PJSIP/ew112_0' })).toBe('112');
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
    expect(callerDisplayLabel('', '')).toBe('—');
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

    it('falls back to muted for an unrecognized status value', () => {
      expect(agentStatusColorFamily('BOGUS' as AgentStatus)).toBe('muted');
    });
  });
});
