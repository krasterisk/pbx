"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.conferenceRecordingRel = conferenceRecordingRel;
exports.safeConferenceRecordingPath = safeConferenceRecordingPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function conferenceRecordingRel(vpbx, roomUid, meetingUid) {
    return `${vpbx}/conferences/${roomUid}/${meetingUid}.wav`;
}
/**
 * Resolve a conference wav under records_base_path (D-30 / T-16.2-01).
 * Same `..` / startsWith guards as voicemail; never appends .mp3.
 */
function safeConferenceRecordingPath(base, rel) {
    const cleaned = String(rel ?? '').replace(/^\/+/, '').replace(/\\/g, '/');
    if (!cleaned || cleaned.includes('..') || path.isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) {
        return null;
    }
    const baseResolved = path.resolve(base);
    const fileResolved = path.resolve(baseResolved, cleaned);
    const prefix = baseResolved.endsWith(path.sep) ? baseResolved : baseResolved + path.sep;
    if (fileResolved !== baseResolved && !fileResolved.startsWith(prefix))
        return null;
    return fs.existsSync(fileResolved) ? fileResolved : null;
}
//# sourceMappingURL=conference-recording-path.util.js.map