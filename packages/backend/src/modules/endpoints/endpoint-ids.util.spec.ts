import {
  buildSipId,
  buildWebrtcSipId,
  extractExtension,
  isWebrtcCompanion,
  companionIdOf,
  primaryIdOf,
  interfaceToExtension,
} from './endpoint-ids.util';

describe('endpoint-ids.util', () => {
  it('builds primary and webrtc sip ids', () => {
    expect(buildSipId(0, '110')).toBe('e110_0');
    expect(buildWebrtcSipId(0, '110')).toBe('ew110_0');
    expect(buildWebrtcSipId(42, '101')).toBe('ew101_42');
  });

  it('extractExtension handles e and ew prefixes', () => {
    expect(extractExtension('e110_0')).toBe('110');
    expect(extractExtension('ew110_0')).toBe('110');
    expect(extractExtension('e101_42')).toBe('101');
    expect(extractExtension('ew101_42')).toBe('101');
  });

  it('detects companion and maps primary ↔ companion', () => {
    expect(isWebrtcCompanion('ew110_0')).toBe(true);
    expect(isWebrtcCompanion('e110_0')).toBe(false);
    expect(companionIdOf('e110_0')).toBe('ew110_0');
    expect(companionIdOf('ew110_0')).toBeNull();
    expect(primaryIdOf('ew110_0')).toBe('e110_0');
    expect(primaryIdOf('e110_0')).toBeNull();
  });

  it('interfaceToExtension strips tech and ew prefix', () => {
    expect(interfaceToExtension('PJSIP/e110_0')).toBe('110');
    expect(interfaceToExtension('PJSIP/ew110_0')).toBe('110');
    expect(interfaceToExtension('ew101_42')).toBe('101');
  });
});
