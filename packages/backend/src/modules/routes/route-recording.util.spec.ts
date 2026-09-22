import {
  buildMixMonitorFlags,
  buildFfmpegPostprocess,
  getRecordingSourceExtension,
  buildStopMixMonitor,
  mixMonitorWithRecorderId,
  shouldRunLegacyFfmpegHangup,
  durableCaptureFileBase,
  generatedDurableLabDialplan,
  recordingDialplanLines,
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

  describe('durable capture helpers', () => {
    it('names files by UUID and stops one recorder', () => {
      expect(durableCaptureFileBase('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001'))
        .toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001');
      expect(() => durableCaptureFileBase('20260919-7900')).toThrow(/UUID/);
      expect(buildStopMixMonitor('rec-1')).toBe('StopMixMonitor(rec-1)');
      expect(mixMonitorWithRecorderId('/tmp/a.wav', 'b', 'rec-1'))
        .toBe('MixMonitor(/tmp/a.wav,b,,rec-1)');
      expect(shouldRunLegacyFfmpegHangup(true)).toBe(false);
      expect(shouldRunLegacyFfmpegHangup(false)).toBe(true);
    });

    it('emits generated-route MixMonitor with hangup_handler and no ffmpeg postprocess', () => {
      const lab = generatedDurableLabDialplan(8);
      expect(lab).toContain('[krasterisk-ai-generated]');
      expect(lab).toContain('Set(__DURABLE_CAPTURE=1)');
      expect(lab).toContain('MixMonitor(/usr/records/8/calls/${path}/${fname}.wav,,,${RECORDER_ID})');
      expect(lab).toContain('hangup_handler_push)=krasterisk-ai-generated-hangup');
      expect(lab).toContain('StopMixMonitor(${RECORDER_ID})');
      expect(lab).not.toContain('ffmpeg');
      expect(recordingDialplanLines({
        vpbxUserUid: 8, durable: true, recordStereo: false, recordAll: true, hangupWebhook: false,
      }).some(line => line.includes('hangup_handler_push)=krsk-hangup-handler'))).toBe(true);
    });

    it('pushes hangup_handler when analytics projectId is set even without hangup webhook', () => {
      const lines = recordingDialplanLines({
        vpbxUserUid: 8,
        durable: false,
        recordStereo: false,
        recordAll: false,
        hangupWebhook: false,
        analyticsProjectId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee4001',
      });
      expect(lines.some((line) => line.includes('hangup_handler_push)=krsk-hangup-handler'))).toBe(true);
      expect(lines.join('\n')).not.toMatch(/SpeechToText|STT|Recognize/i);
    });

    it('does not push hangup_handler for non-durable capture without webhook or project', () => {
      const lines = recordingDialplanLines({
        vpbxUserUid: 8,
        durable: false,
        recordStereo: false,
        recordAll: false,
        hangupWebhook: false,
      });
      expect(lines.some((line) => line.includes('hangup_handler_push'))).toBe(false);
    });
  });
});
