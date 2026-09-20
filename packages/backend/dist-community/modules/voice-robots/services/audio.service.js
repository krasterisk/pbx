"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const common_1 = require("@nestjs/common");
/**
 * Audio processing utilities for telephony audio.
 * Handles G.711 A-law ↔ PCM16 conversion and sample rate resampling.
 * All methods are zero-dependency, pure TypeScript implementations.
 */
// Pre-computed A-law → Linear PCM16 lookup table (ITU-T G.711)
const alawToLinearTable = new Int16Array(256);
for (let i = 0; i < 256; i++) {
    let val = i ^ 0x55;
    let t = (val & 0x0f) << 4;
    const seg = (val & 0x70) >> 4;
    switch (seg) {
        case 0:
            t += 8;
            break;
        case 1:
            t += 0x108;
            break;
        default:
            t += 0x108;
            t <<= seg - 1;
            break;
    }
    alawToLinearTable[i] = val & 0x80 ? t : -t;
}
let AudioService = class AudioService {
    /**
     * Remove 12-byte RTP header from a raw UDP packet.
     */
    removeRTPHeader(payload) {
        return payload.subarray(12);
    }
    /**
     * Decode G.711 A-law Buffer to raw 16-bit PCM Buffer.
     */
    decodeAlawToPcm16(alawBuffer) {
        const pcmBuffer = Buffer.alloc(alawBuffer.length * 2);
        for (let i = 0; i < alawBuffer.length; i++) {
            const pcmSample = alawToLinearTable[alawBuffer[i]];
            pcmBuffer.writeInt16LE(pcmSample, i * 2);
        }
        return pcmBuffer;
    }
    /**
     * Decode G.711 A-law Buffer directly into a Float32Array
     * with samples normalized between -1.0 and 1.0 (required for ONNX/VAD).
     */
    decodeAlawToFloat32(alawBuffer) {
        const floatArray = new Float32Array(alawBuffer.length);
        for (let i = 0; i < alawBuffer.length; i++) {
            const pcmSample = alawToLinearTable[alawBuffer[i]];
            floatArray[i] = pcmSample / 32768.0;
        }
        return floatArray;
    }
    /**
     * Encode PCM16 (LE) → G.711 A-law.
     * Used for streaming TTS audio back to Asterisk via RTP.
     */
    encodePcm16ToAlaw(input) {
        const output = Buffer.alloc(input.length / 2);
        for (let i = 0; i < output.length; i++) {
            const sample = input.readInt16LE(i * 2);
            output[i] = this.encodeAlawSample(sample);
        }
        return output;
    }
    /**
     * Linear resample PCM16 (LE) between sample rates.
     * Uses linear interpolation. Suitable for 8k ↔ 16k ↔ 24k.
     */
    resampleLinear(input, inRate, outRate) {
        if (inRate === outRate)
            return input;
        const samples = input.length / 2;
        const outSamples = Math.floor((samples * outRate) / inRate);
        const output = Buffer.alloc(outSamples * 2);
        for (let i = 0; i < outSamples; i++) {
            const t = (i * inRate) / outRate;
            const i0 = Math.floor(t);
            const i1 = Math.min(i0 + 1, samples - 1);
            const frac = t - i0;
            const s0 = input.readInt16LE(i0 * 2);
            const s1 = input.readInt16LE(i1 * 2);
            const sample = s0 + frac * (s1 - s0);
            output.writeInt16LE(sample | 0, i * 2);
        }
        return output;
    }
    /**
     * Encode a single PCM16 sample to A-law.
     */
    encodeAlawSample(sample) {
        const sign = (sample >> 8) & 0x80;
        if (sign)
            sample = -sample;
        if (sample > 32635)
            sample = 32635;
        let exponent = 7;
        for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
            exponent--;
        }
        const mantissa = (sample >> (exponent === 0 ? 4 : exponent + 3)) & 0x0f;
        return (sign | (exponent << 4) | mantissa) ^ 0x55;
    }
};
exports.AudioService = AudioService;
exports.AudioService = AudioService = __decorate([
    (0, common_1.Injectable)()
], AudioService);
//# sourceMappingURL=audio.service.js.map