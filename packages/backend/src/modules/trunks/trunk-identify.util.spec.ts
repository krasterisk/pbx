import {
  identifyNeedsSrvLookup,
  identifyRowId,
  normalizeIdentifyMatch,
  parseIdentifyMatches,
} from './trunk-identify.util';

describe('trunk-identify.util', () => {
  it('strips sip: and :port from a hostname', () => {
    expect(normalizeIdentifyMatch('sip:npbx.krasterisk.ru:5060')).toBe('npbx.krasterisk.ru');
  });

  it('keeps CIDR intact', () => {
    expect(normalizeIdentifyMatch('185.175.158.0/24')).toBe('185.175.158.0/24');
  });

  it('parses comma-separated hosts and IPs', () => {
    expect(parseIdentifyMatches('npbx.krasterisk.ru, 185.175.158.149')).toEqual([
      'npbx.krasterisk.ru',
      '185.175.158.149',
    ]);
  });

  it('enables SRV lookup only for hostnames', () => {
    expect(identifyNeedsSrvLookup('npbx.krasterisk.ru')).toBe(true);
    expect(identifyNeedsSrvLookup('185.175.158.149')).toBe(false);
  });

  it('keeps identify row ids within 40 chars', () => {
    expect(identifyRowId('t_test_trunk_0', 0)).toBe('t_test_trunk_0_identify');
    expect(identifyRowId('t_very_long_provider_name_here_0', 1).length).toBeLessThanOrEqual(40);
  });
});
