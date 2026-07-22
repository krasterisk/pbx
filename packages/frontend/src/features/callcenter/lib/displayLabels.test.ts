import { describe, it, expect } from 'vitest';
import {
  agentDisplayName,
  queueDisplayName,
  callerDisplayLabel,
  isRawAgentName,
} from './displayLabels';

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
});
