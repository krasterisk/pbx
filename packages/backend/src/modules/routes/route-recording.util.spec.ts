import {
  buildMixMonitorFlags,
  buildFfmpegPostprocess,
  getRecordingSourceExtension,
} from './route-recording.util';

describe('route-recording.util', () => {
  describe('buildMixMonitorFlags', () => {
    it('uses b for on-answer recording', () => {
      expect(buildMixMonitorFlags({})).toBe('b');
      expect(buildMixMonitorFlags({ record_all: false })).toBe('b');
    });

    it('omits b when record_all is set', () => {
      expect(buildMixMonitorFlags({ record_all: true })).toBe('');
    });

    it('appends D for stereo', () => {
      expect(buildMixMonitorFlags({ record_stereo: true })).toBe('bD');
      expect(buildMixMonitorFlags({ record_all: true, record_stereo: true })).toBe('D');
    });
  });

  describe('getRecordingSourceExtension', () => {
    it('returns raw for stereo and wav for mono', () => {
      expect(getRecordingSourceExtension(false)).toBe('wav');
      expect(getRecordingSourceExtension(true)).toBe('raw');
    });
  });

  describe('buildFfmpegPostprocess', () => {
    const base = '/usr/records/7/calls/20260716/file';

    it('builds mono wav conversion', () => {
      const cmd = buildFfmpegPostprocess(base, false);
      expect(cmd).toContain(`${base}.wav`);
      expect(cmd).toContain('-ac 1');
      expect(cmd).not.toContain('-f s16le');
    });

    it('builds stereo raw conversion', () => {
      const cmd = buildFfmpegPostprocess(base, true);
      expect(cmd).toContain(`${base}.raw`);
      expect(cmd).toContain('-f s16le');
      expect(cmd).toContain('-ac 2');
      expect(cmd).toContain('-b:a 64k');
    });
  });
});
