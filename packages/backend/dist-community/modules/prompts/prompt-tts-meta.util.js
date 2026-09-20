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
exports.ttsMetaBasename = ttsMetaBasename;
exports.ttsMetaFileName = ttsMetaFileName;
exports.resolveTtsMetaPath = resolveTtsMetaPath;
exports.readTtsMetaFile = readTtsMetaFile;
exports.writeTtsMetaFile = writeTtsMetaFile;
exports.deleteTtsMetaFile = deleteTtsMetaFile;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const prompts_audio_util_1 = require("./prompts-audio.util");
function ttsMetaBasename(filename) {
    const safe = (0, prompts_audio_util_1.sanitizePromptFilename)(filename);
    if (!safe)
        return null;
    return path.extname(safe) ? path.parse(safe).name : safe;
}
function ttsMetaFileName(filename) {
    const base = ttsMetaBasename(filename);
    return base ? `${base}.tts.json` : null;
}
function resolveTtsMetaPath(soundsDir, filename) {
    const metaName = ttsMetaFileName(filename);
    if (!metaName)
        return null;
    return (0, prompts_audio_util_1.resolveUnderDir)(soundsDir, metaName);
}
async function readTtsMetaFile(filePath) {
    try {
        const raw = await fs_1.promises.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed?.text?.trim() || !parsed.engine_uid) {
            return null;
        }
        return {
            text: parsed.text.trim(),
            engine_uid: Number(parsed.engine_uid),
            settings: parsed.settings,
        };
    }
    catch {
        return null;
    }
}
async function writeTtsMetaFile(filePath, meta) {
    const payload = {
        text: meta.text.trim(),
        engine_uid: meta.engine_uid,
        settings: meta.settings,
    };
    await fs_1.promises.writeFile(filePath, JSON.stringify(payload), 'utf8');
}
async function deleteTtsMetaFile(filePath) {
    try {
        await fs_1.promises.unlink(filePath);
    }
    catch {
        // ignore missing
    }
}
//# sourceMappingURL=prompt-tts-meta.util.js.map