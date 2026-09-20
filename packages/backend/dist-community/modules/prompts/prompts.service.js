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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PromptsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const prompt_model_1 = require("./prompt.model");
const ami_service_1 = require("../ami/ami.service");
const system_settings_service_1 = require("../system-settings/system-settings.service");
const prompts_audio_util_1 = require("./prompts-audio.util");
const prompt_tts_meta_util_1 = require("./prompt-tts-meta.util");
let PromptsService = PromptsService_1 = class PromptsService {
    promptModel;
    amiService;
    systemSettings;
    logger = new common_1.Logger(PromptsService_1.name);
    constructor(promptModel, amiService, systemSettings) {
        this.promptModel = promptModel;
        this.amiService = amiService;
        this.systemSettings = systemSettings;
    }
    async getRecordsBasePath() {
        const cfg = await this.systemSettings.getServerConfigRaw();
        return cfg.records_base_path || '/usr/records';
    }
    async getSoundsDir(userUid) {
        const base = await this.getRecordsBasePath();
        return path.resolve(base, String(userUid), 'sounds');
    }
    async resolvePromptAudioFile(userUid, filename) {
        const soundsDir = await this.getSoundsDir(userUid);
        for (const candidate of (0, prompts_audio_util_1.promptAudioCandidates)(filename)) {
            const filePath = (0, prompts_audio_util_1.resolveUnderDir)(soundsDir, candidate);
            if (!filePath)
                continue;
            try {
                await fs_1.promises.access(filePath);
                return { filePath, contentType: (0, prompts_audio_util_1.contentTypeForFile)(filePath) };
            }
            catch {
                // try next extension
            }
        }
        return null;
    }
    async savePromptAudio(userUid, filename, data, preferredExt) {
        const safe = (0, prompts_audio_util_1.sanitizePromptFilename)(filename);
        if (!safe) {
            throw new common_1.BadRequestException('Invalid prompt filename');
        }
        const soundsDir = await this.getSoundsDir(userUid);
        await fs_1.promises.mkdir(soundsDir, { recursive: true });
        const ext = preferredExt?.startsWith('.')
            ? preferredExt.toLowerCase()
            : path.extname(safe) || '.wav';
        const baseName = path.extname(safe) ? path.parse(safe).name : safe;
        const targetName = `${baseName}${ext}`;
        const filePath = (0, prompts_audio_util_1.resolveUnderDir)(soundsDir, targetName);
        if (!filePath) {
            throw new common_1.BadRequestException('Invalid prompt filename');
        }
        await fs_1.promises.writeFile(filePath, data);
        this.logger.log(`Saved prompt audio: ${filePath}`);
    }
    async streamPromptAudio(userUid, prompt, res) {
        const resolved = await this.resolvePromptAudioFile(userUid, prompt.filename);
        if (!resolved) {
            throw new common_1.NotFoundException('Audio file not found');
        }
        const stat = await fs_1.promises.stat(resolved.filePath);
        res.setHeader('Content-Type', resolved.contentType);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(resolved.filePath)}"`);
        res.setHeader('Content-Length', String(stat.size));
        res.status(200);
        const stream = (0, fs_1.createReadStream)(resolved.filePath);
        stream.on('error', () => {
            if (!res.headersSent) {
                res.status(500).end();
            }
            else {
                res.end();
            }
        });
        stream.pipe(res);
    }
    async loadTtsMeta(userUid, filename) {
        const soundsDir = await this.getSoundsDir(userUid);
        const metaPath = (0, prompt_tts_meta_util_1.resolveTtsMetaPath)(soundsDir, filename);
        if (!metaPath)
            return null;
        return (0, prompt_tts_meta_util_1.readTtsMetaFile)(metaPath);
    }
    async saveTtsMeta(userUid, filename, meta) {
        const soundsDir = await this.getSoundsDir(userUid);
        await fs_1.promises.mkdir(soundsDir, { recursive: true });
        const metaPath = (0, prompt_tts_meta_util_1.resolveTtsMetaPath)(soundsDir, filename);
        if (!metaPath) {
            throw new common_1.BadRequestException('Invalid prompt filename');
        }
        await (0, prompt_tts_meta_util_1.writeTtsMetaFile)(metaPath, meta);
    }
    async removeTtsMeta(userUid, filename) {
        const soundsDir = await this.getSoundsDir(userUid);
        const metaPath = (0, prompt_tts_meta_util_1.resolveTtsMetaPath)(soundsDir, filename);
        if (metaPath) {
            await (0, prompt_tts_meta_util_1.deleteTtsMetaFile)(metaPath);
        }
    }
    async toPublicPrompt(prompt, userUid) {
        const tts = await this.loadTtsMeta(userUid, prompt.filename);
        const source_type = tts ? 'tts' : 'file';
        return {
            uid: prompt.uid,
            filename: prompt.filename,
            comment: prompt.comment,
            description: prompt.description,
            user_uid: prompt.user_uid,
            source_type,
            tts,
        };
    }
    async findAll(userUid) {
        const rows = await this.promptModel.findAll({
            where: { user_uid: userUid },
            order: [['uid', 'DESC']],
        });
        return Promise.all(rows.map((row) => this.toPublicPrompt(row, userUid)));
    }
    async findOneRow(uid, userUid) {
        const prompt = await this.promptModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!prompt)
            throw new common_1.NotFoundException('Prompt not found');
        return prompt;
    }
    async findOne(uid, userUid) {
        return this.toPublicPrompt(await this.findOneRow(uid, userUid), userUid);
    }
    generateFilename(userUid) {
        const timestamp = Date.now();
        return `prompt_${userUid}_${timestamp}`;
    }
    async create(data, userUid) {
        const row = await this.promptModel.create({
            filename: data.filename,
            comment: data.comment || '',
            description: data.description || '',
            user_uid: userUid,
        });
        if (data.tts) {
            await this.saveTtsMeta(userUid, data.filename, data.tts);
        }
        return this.toPublicPrompt(row, userUid);
    }
    async update(uid, data, userUid, resynthesize) {
        const prompt = await this.findOneRow(uid, userUid);
        const existingTts = await this.loadTtsMeta(userUid, prompt.filename);
        const dbPatch = {};
        if (data.comment !== undefined) {
            const comment = data.comment.trim();
            if (!comment) {
                throw new common_1.BadRequestException('Название записи обязательно');
            }
            dbPatch.comment = comment;
        }
        if (data.description !== undefined) {
            dbPatch.description = data.description.trim();
        }
        if (data.tts) {
            if (!existingTts) {
                throw new common_1.BadRequestException('TTS settings apply only to synthesized recordings');
            }
            if (!data.tts.text?.trim() || !data.tts.engine_uid) {
                throw new common_1.BadRequestException('TTS text and engine are required');
            }
            const meta = {
                text: data.tts.text.trim(),
                engine_uid: data.tts.engine_uid,
                settings: data.tts.settings,
            };
            if (resynthesize) {
                await resynthesize(prompt.filename, meta);
            }
            await this.saveTtsMeta(userUid, prompt.filename, meta);
        }
        if (Object.keys(dbPatch).length > 0) {
            await prompt.update(dbPatch);
        }
        return this.toPublicPrompt(prompt, userUid);
    }
    async remove(uid, userUid) {
        const prompt = await this.findOneRow(uid, userUid);
        const { filename } = prompt;
        await this.removeTtsMeta(userUid, filename);
        await prompt.destroy();
        return { filename };
    }
    async recordByPhone(exten, filename, userUid) {
        try {
            await this.amiService.action({
                action: 'Originate',
                channel: exten,
                callerid: 'Record',
                context: 'record_dial',
                exten: 'start',
                priority: '1',
                variable: `FILENAME=${filename},VPBX_UID=${userUid}`,
                async: 'true',
            });
            this.logger.log(`Recording initiated: exten=${exten}, file=${filename}`);
        }
        catch (err) {
            this.logger.error(`Failed to originate recording: ${err}`);
            throw new common_1.BadRequestException('Failed to initiate recording call');
        }
    }
    async bulkRemove(uids, userUid) {
        const deleted = await this.promptModel.destroy({
            where: { uid: uids, user_uid: userUid },
        });
        return { deleted };
    }
};
exports.PromptsService = PromptsService;
exports.PromptsService = PromptsService = PromptsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(prompt_model_1.Prompt)),
    __metadata("design:paramtypes", [Object, ami_service_1.AmiService,
        system_settings_service_1.SystemSettingsService])
], PromptsService);
//# sourceMappingURL=prompts.service.js.map