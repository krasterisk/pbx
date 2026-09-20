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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const path = __importStar(require("path"));
const prompts_service_1 = require("./prompts.service");
const ivr_tts_service_1 = require("../ivrs/ivr-tts.service");
const prompt_tts_dto_1 = require("./dto/prompt-tts.dto");
const prompt_update_dto_1 = require("./dto/prompt-update.dto");
let PromptsController = class PromptsController {
    promptsService;
    ivrTtsService;
    constructor(promptsService, ivrTtsService) {
        this.promptsService = promptsService;
        this.ivrTtsService = ivrTtsService;
    }
    async findAll(req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.promptsService.findAll(userUid);
    }
    async findOne(id, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.promptsService.findOne(id, userUid);
    }
    /**
     * Upload a new audio prompt.
     * File is received via multipart form-data.
     * In production, this would:
     * 1. Convert to WAV 8kHz mono 16-bit via sox/ffmpeg
     * 2. Upload to Asterisk server via SFTP
     * 3. Save metadata to DB
     */
    async upload(file, comment, description, req) {
        if (!file) {
            throw new common_1.BadRequestException('No audio file provided');
        }
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        const filename = this.promptsService.generateFilename(userUid);
        const ext = path.extname(file.originalname) || '.wav';
        await this.promptsService.savePromptAudio(userUid, filename, file.buffer, ext);
        const prompt = await this.promptsService.create({
            filename,
            comment: comment || file.originalname,
            description: description || '',
        }, userUid);
        return prompt;
    }
    /**
     * Initiate a recording by calling an extension via AMI.
     */
    async record(exten, comment, description, req) {
        if (!exten) {
            throw new common_1.BadRequestException('Extension is required');
        }
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        const filename = this.promptsService.generateFilename(userUid);
        // Initiate AMI originate
        await this.promptsService.recordByPhone(exten, filename, userUid);
        // Create DB record
        await this.promptsService.create({
            filename,
            comment: comment || `Recording ${filename}`,
            description: description || '',
        }, userUid);
        return { message: 'Recording initiated', filename };
    }
    async ttsPreview(dto, req, res) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        try {
            const engine = await this.ivrTtsService.loadEngine(dto.engine_uid, userUid);
            const wav = await this.ivrTtsService.synthesizeToBuffer(engine, dto.text, dto.settings);
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Length', String(wav.length));
            res.send(wav);
        }
        catch (err) {
            throw new common_1.BadRequestException(err.message || 'TTS preview failed');
        }
    }
    /**
     * Synthesize speech via a configured TTS engine and register a prompt record.
     * Audio file upload to Asterisk (SFTP) is deferred — metadata is persisted now.
     */
    async synthesize(dto, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        const comment = dto.comment?.trim();
        if (!comment) {
            throw new common_1.BadRequestException('Recording name is required');
        }
        let wav;
        try {
            const engine = await this.ivrTtsService.loadEngine(dto.engine_uid, userUid);
            wav = await this.ivrTtsService.synthesizeToBuffer(engine, dto.text, dto.settings);
        }
        catch (err) {
            throw new common_1.BadRequestException(err.message || 'TTS synthesis failed');
        }
        const filename = this.promptsService.generateFilename(userUid);
        await this.promptsService.savePromptAudio(userUid, filename, wav, '.wav');
        const ttsMeta = {
            text: dto.text.trim(),
            engine_uid: dto.engine_uid,
            settings: dto.settings,
        };
        return this.promptsService.create({
            filename,
            comment,
            description: dto.description?.trim() || '',
            tts: ttsMeta,
        }, userUid);
    }
    /**
     * Stream audio file for browser playback.
     * TODO: Phase 3 — download from Asterisk via SFTP and pipe to response.
     */
    async stream(id, req, res) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        const prompt = await this.promptsService.findOneRow(id, userUid);
        await this.promptsService.streamPromptAudio(userUid, prompt, res);
    }
    async update(id, body, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.promptsService.update(id, {
            comment: body.comment,
            description: body.description,
            tts: body.tts,
        }, userUid, async (filename, meta) => {
            const engine = await this.ivrTtsService.loadEngine(meta.engine_uid, userUid);
            const wav = await this.ivrTtsService.synthesizeToBuffer(engine, meta.text, meta.settings);
            await this.promptsService.savePromptAudio(userUid, filename, wav, '.wav');
        });
    }
    async remove(id, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        const { filename } = await this.promptsService.remove(id, userUid);
        // audio file on disk left for manual cleanup until SFTP lifecycle is implemented
        // TODO: Phase 3 — delete file from Asterisk via SFTP
        return { message: 'Prompt deleted', filename };
    }
    async bulkDelete(body, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.promptsService.bulkRemove(body.ids, userUid);
    }
};
exports.PromptsController = PromptsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype.startsWith('audio/')) {
                cb(new common_1.BadRequestException('Only audio files are allowed'), false);
            }
            else {
                cb(null, true);
            }
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('comment')),
    __param(2, (0, common_1.Body)('description')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('record'),
    __param(0, (0, common_1.Body)('exten')),
    __param(1, (0, common_1.Body)('comment')),
    __param(2, (0, common_1.Body)('description')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "record", null);
__decorate([
    (0, common_1.Post)('tts-preview'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [prompt_tts_dto_1.PromptTtsPreviewDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "ttsPreview", null);
__decorate([
    (0, common_1.Post)('synthesize'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [prompt_tts_dto_1.PromptSynthesizeDto, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "synthesize", null);
__decorate([
    (0, common_1.Get)(':id/stream'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "stream", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, prompt_update_dto_1.PromptUpdateDto, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromptsController.prototype, "bulkDelete", null);
exports.PromptsController = PromptsController = __decorate([
    (0, common_1.Controller)('prompts'),
    __metadata("design:paramtypes", [prompts_service_1.PromptsService,
        ivr_tts_service_1.IvrTtsService])
], PromptsController);
//# sourceMappingURL=prompts.controller.js.map