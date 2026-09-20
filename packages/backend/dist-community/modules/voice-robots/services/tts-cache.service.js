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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TtsCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsCacheService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/**
 * TTS Audio Cache Service.
 *
 * Caches synthesized audio files on disk as G.711 A-law (8kHz) to avoid
 * redundant API calls for repeated phrases. Cache key is MD5 of the
 * composite string: text + voice + speed + engineType.
 *
 * Cache eviction: files older than `maxAgeDays` are removed.
 * If maxAgeDays === 0, files are kept indefinitely (unlimited mode).
 *
 * File naming: `<md5hash>.alaw`
 * Atomic writes: write to `.tmp` → rename (prevents torn reads)
 */
let TtsCacheService = TtsCacheService_1 = class TtsCacheService {
    logger = new common_1.Logger(TtsCacheService_1.name);
    cacheDir;
    constructor() {
        // Place cache inside project's data directory
        this.cacheDir = path.join(process.cwd(), 'data', 'tts-cache');
    }
    async onModuleInit() {
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            this.logger.log(`Cache directory created: ${this.cacheDir}`);
        }
        const stats = this.getCacheStats();
        this.logger.log(`TTS cache initialized: ${stats.files} files, ${stats.totalSizeMB.toFixed(1)} MB`);
    }
    /**
     * Generate an MD5-based cache key from synthesis parameters.
     * Deterministic: same text + voice + speed + engine always produces the same key.
     */
    getCacheKey(text, voice, speed, engineType) {
        const composite = `${text}|${voice}|${speed}|${engineType}`;
        return crypto.createHash('md5').update(composite, 'utf8').digest('hex');
    }
    /**
     * Check if a cached file exists for the given key.
     */
    has(key) {
        return fs.existsSync(this.getFilePath(key));
    }
    /**
     * Read cached A-law audio buffer from disk.
     * @throws if file does not exist (always check `has()` first)
     */
    get(key) {
        return fs.readFileSync(this.getFilePath(key));
    }
    /**
     * Store an A-law audio buffer in the cache.
     * Uses atomic write pattern: write to .tmp file → rename.
     * This prevents torn reads if another session is reading concurrently.
     */
    put(key, alawBuffer) {
        const filePath = this.getFilePath(key);
        const tmpPath = `${filePath}.tmp`;
        try {
            fs.writeFileSync(tmpPath, alawBuffer);
            fs.renameSync(tmpPath, filePath);
        }
        catch (err) {
            this.logger.error(`Failed to write cache file ${key}: ${err.message}`);
            // Cleanup temp file on failure
            try {
                if (fs.existsSync(tmpPath))
                    fs.unlinkSync(tmpPath);
            }
            catch { /* ignore cleanup errors */ }
        }
    }
    /**
     * Remove cached files older than `maxAgeDays`.
     * If maxAgeDays === 0, no files are removed (unlimited retention).
     *
     * @returns number of files removed
     */
    evict(maxAgeDays) {
        if (maxAgeDays <= 0)
            return 0; // 0 = unlimited, keep everything
        const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        let removed = 0;
        try {
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                if (!file.endsWith('.alaw'))
                    continue;
                const filePath = path.join(this.cacheDir, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.mtimeMs < cutoffMs) {
                        fs.unlinkSync(filePath);
                        removed++;
                    }
                }
                catch { /* ignore individual file errors */ }
            }
        }
        catch (err) {
            this.logger.error(`Cache eviction error: ${err.message}`);
        }
        if (removed > 0) {
            this.logger.log(`Cache eviction: removed ${removed} files older than ${maxAgeDays} days`);
        }
        return removed;
    }
    /**
     * Get cache statistics.
     */
    getCacheStats() {
        try {
            const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.alaw'));
            let totalBytes = 0;
            for (const file of files) {
                try {
                    const stat = fs.statSync(path.join(this.cacheDir, file));
                    totalBytes += stat.size;
                }
                catch { /* ignore */ }
            }
            return { files: files.length, totalSizeMB: totalBytes / (1024 * 1024) };
        }
        catch {
            return { files: 0, totalSizeMB: 0 };
        }
    }
    /**
     * Resolve full file path for a cache key.
     */
    getFilePath(key) {
        return path.join(this.cacheDir, `${key}.alaw`);
    }
};
exports.TtsCacheService = TtsCacheService;
exports.TtsCacheService = TtsCacheService = TtsCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], TtsCacheService);
//# sourceMappingURL=tts-cache.service.js.map