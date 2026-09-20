"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SystemSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingsService = exports.MANAGED_KEYS = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const system_setting_model_1 = require("./system-setting.model");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/** Keys managed via UI — stored in system_settings table */
exports.MANAGED_KEYS = ['records_base_path', 'records_base_url', 'webhook_secret'];
let SystemSettingsService = SystemSettingsService_1 = class SystemSettingsService {
    settingModel;
    config;
    logger = new common_1.Logger(SystemSettingsService_1.name);
    warnedMissingTable = false;
    constructor(settingModel, config) {
        this.settingModel = settingModel;
        this.config = config;
    }
    isMissingTableError(err) {
        const parent = err?.parent;
        return parent?.code === 'ER_NO_SUCH_TABLE' || parent?.errno === 1146;
    }
    /** DB overrides for managed keys; empty map if table is absent (falls back to .env). */
    async loadManagedSettingsMap() {
        try {
            const rows = await this.settingModel.findAll({
                where: { key: exports.MANAGED_KEYS },
            });
            return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
        }
        catch (err) {
            if (!this.isMissingTableError(err))
                throw err;
            if (!this.warnedMissingTable) {
                this.warnedMissingTable = true;
                this.logger.warn('system_settings table not found — using .env defaults. Run: npx ts-node src/modules/system-settings/migrate-system-settings.ts');
            }
            return {};
        }
    }
    async findAll() {
        try {
            return await this.settingModel.findAll();
        }
        catch (err) {
            if (this.isMissingTableError(err))
                return [];
            throw err;
        }
    }
    /**
     * Get server config values.
     * Priority: system_settings table > .env > defaults
     * The table overrides allow UI-based config without server SSH access.
     */
    async getServerConfig() {
        const map = await this.loadManagedSettingsMap();
        return {
            records_base_path: map['records_base_path'] ?? this.config.get('RECORDS_BASE_PATH') ?? '/usr/records',
            records_base_url: map['records_base_url'] ?? this.config.get('RECORDS_BASE_URL') ?? '',
            // NEVER expose actual secret — return masked value if set
            webhook_secret: map['webhook_secret']
                ? '••••••••'
                : this.config.get('WEBHOOK_SECRET')
                    ? '••••••••'
                    : '',
        };
    }
    /**
     * Get raw (unmasked) config values for internal use.
     */
    async getServerConfigRaw() {
        const map = await this.loadManagedSettingsMap();
        return {
            records_base_path: map['records_base_path'] ?? this.config.get('RECORDS_BASE_PATH') ?? '/usr/records',
            records_base_url: map['records_base_url'] ?? this.config.get('RECORDS_BASE_URL') ?? '',
            webhook_secret: map['webhook_secret'] ?? this.config.get('WEBHOOK_SECRET') ?? '',
        };
    }
    /**
     * Update one or more server config keys.
     * Empty string clears the DB override (falls back to .env).
     */
    async updateServerConfig(updates) {
        const updated = [];
        for (const [key, value] of Object.entries(updates)) {
            if (!exports.MANAGED_KEYS.includes(key))
                continue;
            // Skip if caller sent masked placeholder back unchanged
            if (value === '••••••••')
                continue;
            if (value === '' || value === null || value === undefined) {
                // Clear DB override → fallback to .env
                await this.settingModel.destroy({ where: { key } });
            }
            else {
                await this.settingModel.upsert({
                    key,
                    value: String(value),
                    category: 'dialplan',
                    updated_at: new Date(),
                });
            }
            updated.push(key);
        }
        return { updated };
    }
    /**
     * Check if ffmpeg is installed and return version info.
     * Runs `ffmpeg -version` via child_process.
     */
    async checkFfmpeg() {
        try {
            const { stdout } = await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
            const firstLine = stdout.split('\n')[0] || '';
            // Extract version from "ffmpeg version 6.1 Copyright..."
            const versionMatch = firstLine.match(/ffmpeg version (\S+)/);
            return {
                available: true,
                version: versionMatch?.[1] ?? firstLine.trim(),
                path: 'ffmpeg',
            };
        }
        catch (err) {
            return {
                available: false,
                error: err?.message?.includes('not found') || err?.code === 'ENOENT'
                    ? 'ffmpeg not found in PATH. Install with: apt install ffmpeg'
                    : err?.message || 'Unknown error',
            };
        }
    }
};
exports.SystemSettingsService = SystemSettingsService;
exports.SystemSettingsService = SystemSettingsService = SystemSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(system_setting_model_1.SystemSetting)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], SystemSettingsService);
//# sourceMappingURL=system-settings.service.js.map