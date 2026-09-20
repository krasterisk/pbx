"use strict";
/**
 * MixMonitor / ffmpeg helpers for route call recording.
 *
 * Stereo uses Asterisk MixMonitor option `D` (interleaved RX/TX channels).
 * Requires `.raw` extension — other extensions produce corrupted stereo output.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMixMonitorFlags = buildMixMonitorFlags;
exports.durableCaptureFileBase = durableCaptureFileBase;
exports.buildStopMixMonitor = buildStopMixMonitor;
exports.mixMonitorWithRecorderId = mixMonitorWithRecorderId;
exports.shouldRunLegacyFfmpegHangup = shouldRunLegacyFfmpegHangup;
exports.getRecordingSourceExtension = getRecordingSourceExtension;
exports.buildMonoFfmpegPostprocess = buildMonoFfmpegPostprocess;
exports.buildStereoFfmpegPostprocess = buildStereoFfmpegPostprocess;
exports.buildFfmpegPostprocess = buildFfmpegPostprocess;
/** MixMonitor flags: `b` = record only when bridged; `D` = stereo interleaved. */
function buildMixMonitorFlags(opts) {
    let flags = '';
    if (opts.record_all !== true)
        flags += 'b';
    if (opts.record_stereo === true)
        flags += 'D';
    return flags;
}
const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function durableCaptureFileBase(recordingUid) {
    if (!UUID_FILE.test(recordingUid)) {
        throw new Error('durable capture filename must be a server UUID');
    }
    return recordingUid;
}
function buildStopMixMonitor(recorderId) {
    return `StopMixMonitor(${recorderId})`;
}
function mixMonitorWithRecorderId(file, flags, recorderId, postprocess) {
    return `MixMonitor(${file},${flags},${postprocess ?? ''},${recorderId})`;
}
function shouldRunLegacyFfmpegHangup(durableCapture) {
    return !durableCapture;
}
function getRecordingSourceExtension(stereo) {
    return stereo ? 'raw' : 'wav';
}
/** ffmpeg command for MixMonitor postprocess (mono WAV → MP3). */
function buildMonoFfmpegPostprocess(basePath) {
    return `nice -n 10 /usr/bin/ffmpeg -y -i ${basePath}.wav -codec:a libmp3lame -b:a 32k -ar 8000 -ac 1 ${basePath}.mp3 -loglevel quiet && rm -f ${basePath}.wav`;
}
/** ffmpeg command for MixMonitor postprocess (stereo RAW → stereo MP3). */
function buildStereoFfmpegPostprocess(basePath) {
    return `nice -n 10 /usr/bin/ffmpeg -y -f s16le -ar 8000 -ac 2 -i ${basePath}.raw -codec:a libmp3lame -b:a 64k -ar 8000 -ac 2 ${basePath}.mp3 -loglevel quiet && rm -f ${basePath}.raw`;
}
function buildFfmpegPostprocess(basePath, stereo) {
    return stereo ? buildStereoFfmpegPostprocess(basePath) : buildMonoFfmpegPostprocess(basePath);
}
//# sourceMappingURL=route-recording.util.js.map