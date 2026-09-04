import { describe, expect, it } from 'vitest';
import {
  matchCatalogValue,
  normalizeBareExtension,
  normalizeTenantDisplayValue,
  stripTenantQueueName,
} from './normalizeTenantDisplayValue';

describe('stripTenantQueueName', () => {
  it('strips q{exten}_{tenant}', () => {
    expect(stripTenantQueueName('q700_0')).toBe('700');
    expect(stripTenantQueueName('Q701_42')).toBe('701');
    expect(stripTenantQueueName(' q800_1 ')).toBe('800');
  });

  it('leaves custom and already-bare names', () => {
    expect(stripTenantQueueName('700')).toBe('700');
    expect(stripTenantQueueName('sales')).toBe('sales');
    expect(stripTenantQueueName('sales_7')).toBe('sales_7');
  });
});

describe('normalizeBareExtension', () => {
  it('strips PJSIP/SIP and tenant endpoint ids', () => {
    expect(normalizeBareExtension('e101_0')).toBe('101');
    expect(normalizeBareExtension('ew101_0')).toBe('101');
    expect(normalizeBareExtension('PJSIP/e101_42')).toBe('101');
    expect(normalizeBareExtension('101')).toBe('101');
  });
});

describe('normalizeTenantDisplayValue', () => {
  it('normalizes queues and endpoints, leaves other tokens', () => {
    expect(normalizeTenantDisplayValue('q700_0')).toBe('700');
    expect(normalizeTenantDisplayValue('e101_0')).toBe('101');
    expect(normalizeTenantDisplayValue('PJSIP/ew110_0')).toBe('110');
    expect(normalizeTenantDisplayValue('mgts')).toBe('mgts');
    expect(normalizeTenantDisplayValue('')).toBe('');
  });
});

describe('matchCatalogValue', () => {
  const queues = [{ value: '700' }, { value: '701' }];

  it('maps a stored realtime queue name onto the catalog exten', () => {
    expect(matchCatalogValue('q700_0', queues)).toBe('700');
    expect(matchCatalogValue('700', queues)).toBe('700');
  });

  it('keeps an unknown token as-is', () => {
    expect(matchCatalogValue('q999_0', queues)).toBe('q999_0');
  });
});
