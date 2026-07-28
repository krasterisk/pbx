import { describe, it, expect } from 'vitest';
import {
  extractExtension,
  isWebrtcCompanion,
  buildWebrtcSipId,
  buildPrimarySipId,
  interfaceToExtension,
} from './endpointIds';

describe('endpointIds', () => {
  it('extractExtension handles e and ew', () => {
    expect(extractExtension('e110_0')).toBe('110');
    expect(extractExtension('ew110_0')).toBe('110');
  });

  it('buildWebrtcSipId from primary', () => {
    expect(buildWebrtcSipId('e110_0')).toBe('ew110_0');
    expect(buildWebrtcSipId('ew110_0')).toBeNull();
  });

  it('buildPrimarySipId from companion', () => {
    expect(buildPrimarySipId('ew112_0')).toBe('e112_0');
    expect(buildPrimarySipId('e112_0')).toBe('e112_0');
    expect(buildPrimarySipId('PJSIP/ew112_0')).toBeNull();
  });

  it('interfaceToExtension for queue member strings', () => {
    expect(interfaceToExtension('PJSIP/ew110_0')).toBe('110');
    expect(isWebrtcCompanion('ew110_0')).toBe(true);
  });
});
