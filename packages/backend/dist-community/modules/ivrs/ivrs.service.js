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
var IvrsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ivr_model_1 = require("./ivr.model");
const tts_engines_service_1 = require("../tts-engines/tts-engines.service");
const dialplan_apply_service_1 = require("../ami/dialplan-apply.service");
const route_references_service_1 = require("../route-references/route-references.service");
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
const ivr_prompts_util_1 = require("./ivr-prompts.util");
const ivr_timeouts_util_1 = require("./ivr-timeouts.util");
const action_params_validation_util_1 = require("../../shared/pipes/action-params-validation.util");
const ivr_menu_actions_util_1 = require("./ivr-menu-actions.util");
let IvrsService = IvrsService_1 = class IvrsService {
    ivrModel;
    ttsEnginesService;
    dialplanApplyService;
    routeReferencesService;
    logger = new common_1.Logger(IvrsService_1.name);
    constructor(ivrModel, ttsEnginesService, dialplanApplyService, routeReferencesService) {
        this.ivrModel = ivrModel;
        this.ttsEnginesService = ttsEnginesService;
        this.dialplanApplyService = dialplanApplyService;
        this.routeReferencesService = routeReferencesService;
    }
    /** Per-tenant IVR dialplan file under krasterisk/ivrs/ (two levels deep for Asterisk include glob). */
    ivrFile(vpbxUserUid) {
        return `krasterisk/ivrs/ivr_${vpbxUserUid}.conf`;
    }
    ivrCategoryName(uid) {
        return `ivr_${uid}`;
    }
    async loadEnginesForPrompts(prompts, vpbxUserUid) {
        const engines = [];
        for (const p of prompts) {
            if (p.kind !== 'tts' || !p.engine_uid || p.engine_uid <= 0)
                continue;
            if (engines.some((e) => e.uid === p.engine_uid))
                continue;
            const engine = await this.ttsEnginesService.findOne(p.engine_uid, vpbxUserUid);
            engines.push({
                uid: engine.uid,
                type: engine.type,
                settings: engine.settings,
            });
        }
        return engines;
    }
    async normalizeAndValidatePrompts(raw, vpbxUserUid) {
        const prompts = (0, ivr_prompts_util_1.normalizeIvrPrompts)(raw);
        const engines = await this.loadEnginesForPrompts(prompts, vpbxUserUid);
        try {
            (0, ivr_prompts_util_1.assertIvrPromptsForSave)(prompts, { engines });
        }
        catch (e) {
            if (e instanceof ivr_prompts_util_1.IvrPromptsValidationError) {
                throw new common_1.BadRequestException(e.message);
            }
            throw e;
        }
        return prompts;
    }
    mapIvrForResponse(ivr) {
        const json = ivr.toJSON();
        json.prompts = (0, ivr_prompts_util_1.normalizeIvrPrompts)(json.prompts);
        return json;
    }
    /**
     * Write `[ivr_{uid}]` via AMI when active; remove category when inactive.
     * DB is already saved — dialplan failures are logged, not thrown (same as call groups).
     */
    async syncIvrDialplan(ivr, vpbxUserUid, isAdmin = false) {
        const file = this.ivrFile(vpbxUserUid);
        const category = this.ivrCategoryName(ivr.uid);
        try {
            if (ivr.active === 0) {
                await this.dialplanApplyService.deleteCategories(file, [category], { reload: true });
                return;
            }
            const dialplan = this.generateIvrDialplan(ivr, vpbxUserUid, isAdmin);
            await this.dialplanApplyService.applyCategories(file, [{ name: category, lines: dialplan.split('\n') }], { reload: true });
        }
        catch (e) {
            this.logger.error(`Dialplan sync failed for IVR ${ivr.uid} (${file}); DB saved — retry/re-save may be needed: ${e?.message || e}`);
        }
    }
    async removeIvrDialplan(uid, vpbxUserUid) {
        const file = this.ivrFile(vpbxUserUid);
        try {
            await this.dialplanApplyService.deleteCategories(file, [this.ivrCategoryName(uid)], { reload: true });
        }
        catch (e) {
            this.logger.error(`Dialplan remove failed for IVR ${uid} (${file}); DB deleted — dialplan may need cleanup: ${e?.message || e}`);
        }
    }
    async findAll(vpbxUserUid) {
        const rows = await this.ivrModel.findAll({
            where: { user_uid: vpbxUserUid },
            order: [['uid', 'DESC']],
        });
        return rows.map((r) => this.mapIvrForResponse(r));
    }
    async findOne(uid, vpbxUserUid) {
        const ivr = await this.ivrModel.findOne({
            where: { uid, user_uid: vpbxUserUid },
        });
        if (!ivr)
            throw new common_1.NotFoundException('IVR not found');
        return this.mapIvrForResponse(ivr);
    }
    async create(data, vpbxUserUid, isAdmin = false) {
        const { user_uid: incomingUserUid, menu_items: rawMenu, prompts: rawPrompts, ...rest } = data;
        if (incomingUserUid != null && Number(incomingUserUid) !== Number(vpbxUserUid)) {
            this.logger.warn(`IVR create ignored payload user_uid=${incomingUserUid}, using tenant=${vpbxUserUid}`);
        }
        const prompts = rawPrompts !== undefined
            ? await this.normalizeAndValidatePrompts(rawPrompts, vpbxUserUid)
            : [];
        const menuItems = rawMenu !== undefined
            ? this.normalizeMenuForWrite(rawMenu, vpbxUserUid, 'create')
            : undefined;
        const created = await this.ivrModel.create({
            ...rest,
            ...(menuItems !== undefined ? { menu_items: menuItems } : {}),
            prompts,
            user_uid: vpbxUserUid,
        });
        this.logger.log(`IVR created uid=${created.uid} tenant=${vpbxUserUid} active=${created.active} menu=${(0, ivr_menu_actions_util_1.summarizeIvrMenu)(created.menu_items)}`);
        await this.syncIvrDialplan(created, vpbxUserUid, isAdmin);
        return this.mapIvrForResponse(created);
    }
    async update(uid, data, vpbxUserUid, isAdmin = false) {
        const ivr = await this.ivrModel.findOne({
            where: { uid, user_uid: vpbxUserUid },
        });
        if (!ivr)
            throw new common_1.NotFoundException('IVR not found');
        const { user_uid: incomingUserUid, ...safe } = data;
        if (incomingUserUid != null && Number(incomingUserUid) !== Number(vpbxUserUid)) {
            this.logger.warn(`IVR update uid=${uid} ignored payload user_uid=${incomingUserUid}, tenant=${vpbxUserUid}`);
        }
        const patch = { ...safe };
        if (data.prompts !== undefined) {
            patch.prompts = await this.normalizeAndValidatePrompts(data.prompts, vpbxUserUid);
        }
        if (data.menu_items !== undefined) {
            patch.menu_items = this.normalizeMenuForWrite(data.menu_items, vpbxUserUid, `update uid=${uid}`);
        }
        await ivr.update(patch);
        await this.syncIvrDialplan(ivr, vpbxUserUid, isAdmin);
        return this.mapIvrForResponse(ivr);
    }
    async getUsage(uid, vpbxUserUid) {
        await this.findOne(uid, vpbxUserUid);
        return this.routeReferencesService.findUsage('ivr', uid, vpbxUserUid);
    }
    async remove(uid, vpbxUserUid) {
        const ivr = await this.ivrModel.findOne({
            where: { uid, user_uid: vpbxUserUid },
        });
        if (!ivr)
            throw new common_1.NotFoundException('IVR not found');
        await this.routeReferencesService.assertNotReferenced('ivr', uid, vpbxUserUid, 'IVR is referenced and cannot be deleted');
        await ivr.destroy();
        await this.removeIvrDialplan(uid, vpbxUserUid);
    }
    /**
     * Generates the dialplan configuration for a specific IVR.
     */
    generateIvrDialplan(ivr, vpbxUserUid, isAdmin = false) {
        const lines = [];
        const safeName = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(ivr.name) || String(ivr.uid);
        lines.push(`[ivr_${ivr.uid}]`);
        lines.push(`exten => start,1,NoOp(IVR: ${safeName})`);
        lines.push(`same => n,Answer()`);
        lines.push(`same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`);
        const timeouts = (0, ivr_timeouts_util_1.resolveIvrTimeouts)(ivr);
        lines.push(`same => n,Set(TIMEOUT(digit)=${timeouts.digit})`);
        lines.push(`same => n,Set(TIMEOUT(response)=${timeouts.response})`);
        if (ivr.max_count > 0) {
            lines.push(`same => n,ExecIf($["\${step${ivr.uid}}" = ""]?Set(__step${ivr.uid}=0))`);
            lines.push(`same => n,Set(__step${ivr.uid}=$[\${step${ivr.uid}} + 1])`);
            lines.push(`same => n,ExecIf($[\${step${ivr.uid}} >= ${ivr.max_count}]?goto(ivr_${ivr.uid},max,1))`);
        }
        const phrases = (0, ivr_prompts_util_1.normalizeIvrPrompts)(ivr.prompts);
        const baseUrl = dialplan_util_1.AsteriskDialplanUtils.backendBaseUrl;
        const apiKey = dialplan_util_1.AsteriskDialplanUtils.dialplanApiKey;
        phrases.forEach((phrase, index) => {
            if (phrase.kind === 'audio') {
                const filename = dialplan_util_1.AsteriskDialplanUtils.sanitizeFilePath(phrase.filename);
                if (filename) {
                    lines.push(`same => n,Background(/usr/records/${vpbxUserUid}/sounds/${filename})`);
                }
                return;
            }
            if (phrase.kind === 'tts' && phrase.engine_uid > 0) {
                const params = new URLSearchParams({
                    ivr_uid: String(ivr.uid),
                    phrase_index: String(index),
                    vpbx_user_uid: String(vpbxUserUid),
                    uniqueid: '${UNIQUEID}',
                });
                if (apiKey) {
                    params.set('api_key', apiKey);
                }
                const url = `${baseUrl}/internal/ivr/play-phrase?${params.toString()}`;
                lines.push(`same => n,Set(IVR_TTS_PATH=\${CURL(${url})})`);
                lines.push(`same => n,ExecIf($["\${IVR_TTS_PATH}" = ""|"\${IVR_TTS_PATH}" = "0"]?NoOp(IVR TTS failed idx ${index}))`);
                lines.push(`same => n,Background(\${IVR_TTS_PATH})`);
            }
        });
        lines.push(`same => n,WaitExten(${timeouts.waitExten})`);
        lines.push('');
        const healed = (0, ivr_menu_actions_util_1.normalizeIvrMenuItems)(ivr.menu_items, vpbxUserUid);
        if (healed.aliases.length) {
            this.logger.warn(`IVR ${ivr.uid} tenant=${vpbxUserUid} healed action aliases at dialplan render: ${JSON.stringify(healed.aliases)}`);
        }
        if (healed.unmapped.length) {
            this.logger.warn(`IVR ${ivr.uid} tenant=${vpbxUserUid} unknown action types at dialplan render: ${JSON.stringify(healed.unmapped)}`);
        }
        const menuItems = healed.items;
        const menuExtens = new Set();
        for (const item of menuItems) {
            const rawDigit = String(item.digit ?? 'i');
            const exten = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(rawDigit) || 'i';
            menuExtens.add(exten);
            const actions = item.actions || [];
            lines.push(`exten => ${exten},1,NoOp(IVR choice: ${exten})`);
            const dp = (0, dialplan_util_1.renderActionChain)(actions, { vpbxUserUid, host: 'ivr', isAdmin });
            if (dp)
                lines.push((0, dialplan_util_1.prefixSamePriority)(dp));
            lines.push('');
        }
        // Fallback only when menu does not already define "max" (user handler wins).
        if (ivr.max_count > 0 && !menuExtens.has('max')) {
            lines.push(`exten => max,1,NoOp(IVR max retries: ${safeName})`);
            lines.push(`same => n,Hangup()`);
            lines.push('');
        }
        const rendered = lines.join('\n');
        this.logger.debug(`IVR ${ivr.uid} tenant=${vpbxUserUid} dialplan ${lines.length} lines menu=${(0, ivr_menu_actions_util_1.summarizeIvrMenu)(menuItems)}`);
        return rendered;
    }
    normalizeMenuForWrite(raw, vpbxUserUid, context) {
        const normalized = (0, ivr_menu_actions_util_1.normalizeIvrMenuItems)(raw, vpbxUserUid);
        if (normalized.aliases.length) {
            this.logger.warn(`IVR ${context} tenant=${vpbxUserUid} rewritten action types: ${JSON.stringify(normalized.aliases)}`);
        }
        if (normalized.unmapped.length) {
            this.logger.warn(`IVR ${context} tenant=${vpbxUserUid} refused unknown action types: ${JSON.stringify(normalized.unmapped)}`);
            throw new common_1.BadRequestException(`Unknown IVR action type: ${normalized.unmapped.map((row) => row.type).join(', ')}. Use DialplanAppsEditor types: toexten, togroup, toqueue, toivr, toroute, totrunk, voicemail, hangup, playback.`);
        }
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)({ menu_items: normalized.items });
        this.logger.log(`IVR ${context} tenant=${vpbxUserUid} menu=${(0, ivr_menu_actions_util_1.summarizeIvrMenu)(normalized.items)}`);
        return normalized.items;
    }
    async bulkRemove(uids, vpbxUserUid) {
        await this.routeReferencesService.assertNotReferenced('ivr', uids, vpbxUserUid, 'IVR is referenced and cannot be deleted');
        const deleted = await this.ivrModel.destroy({
            where: { uid: uids, user_uid: vpbxUserUid },
        });
        if (deleted > 0 && uids.length > 0) {
            const file = this.ivrFile(vpbxUserUid);
            const categories = uids.map((uid) => this.ivrCategoryName(uid));
            try {
                await this.dialplanApplyService.deleteCategories(file, categories, { reload: true });
            }
            catch (e) {
                const ids = uids.join(',');
                this.logger.error(`Dialplan bulk remove failed for IVRs [${ids}] (${file}); DB deleted - dialplan may need cleanup: ${e?.message || e}`);
            }
        }
        return { deleted };
    }
};
exports.IvrsService = IvrsService;
exports.IvrsService = IvrsService = IvrsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ivr_model_1.Ivr)),
    __metadata("design:paramtypes", [Object, tts_engines_service_1.TtsEnginesService,
        dialplan_apply_service_1.DialplanApplyService,
        route_references_service_1.RouteReferencesService])
], IvrsService);
//# sourceMappingURL=ivrs.service.js.map