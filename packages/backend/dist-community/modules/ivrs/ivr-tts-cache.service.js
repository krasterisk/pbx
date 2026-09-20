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
var IvrTtsCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrTtsCacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let IvrTtsCacheService = IvrTtsCacheService_1 = class IvrTtsCacheService {
    config;
    logger = new common_1.Logger(IvrTtsCacheService_1.name);
    cacheDir;
    constructor(config) {
        this.config = config;
        this.cacheDir =
            this.config.get('IVR_TTS_CACHE_DIR')
                || path.join(process.env.TMPDIR || '/tmp', 'krasterisk-ivr-tts');
    }
    /**
     * Writes WAV bytes and returns path suitable for Asterisk Background().
     * Path is absolute under cache dir; deployment must mount cache for Asterisk.
     */
    writeWav(vpbxUserUid, cacheKey, wavBuffer) {
        const dir = path.join(this.cacheDir, String(vpbxUserUid));
        fs.mkdirSync(dir, { recursive: true });
        const hash = crypto.createHash('sha256').update(cacheKey).digest('hex').slice(0, 24);
        const filePath = path.join(dir, `${hash}.wav`);
        fs.writeFileSync(filePath, wavBuffer);
        return filePath;
    }
    static buildCacheKey(parts) {
        return JSON.stringify(parts);
    }
};
exports.IvrTtsCacheService = IvrTtsCacheService;
exports.IvrTtsCacheService = IvrTtsCacheService = IvrTtsCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], IvrTtsCacheService);
//# sourceMappingURL=ivr-tts-cache.service.js.map