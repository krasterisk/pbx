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
exports.sanitizeAvatarFilename = sanitizeAvatarFilename;
exports.avatarContentType = avatarContentType;
exports.avatarExtFromMime = avatarExtFromMime;
exports.resolveUnderDir = resolveUnderDir;
const path = __importStar(require("path"));
const MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
};
const ALLOWED_EXT = new Set(Object.keys(MIME_BY_EXT));
function sanitizeAvatarFilename(filename) {
    const trimmed = filename.trim();
    if (!trimmed || trimmed.includes('..') || /[\\/]/.test(trimmed)) {
        return null;
    }
    const base = path.basename(trimmed);
    if (!base || base === '.' || base === '..') {
        return null;
    }
    const ext = path.extname(base).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
        return null;
    }
    return base;
}
function avatarContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_BY_EXT[ext] || 'application/octet-stream';
}
function avatarExtFromMime(mimetype) {
    const map = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
    };
    return map[mimetype] || null;
}
function resolveUnderDir(dir, basename) {
    const resolvedDir = path.resolve(dir);
    const resolvedFile = path.resolve(resolvedDir, basename);
    if (resolvedFile !== resolvedDir && !resolvedFile.startsWith(`${resolvedDir}${path.sep}`)) {
        return null;
    }
    return resolvedFile;
}
//# sourceMappingURL=users-avatar.util.js.map