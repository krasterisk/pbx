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
var ConfbridgeStaticProfileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfbridgeStaticProfileService = void 0;
const common_1 = require("@nestjs/common");
const ami_service_1 = require("../ami/ami.service");
const dialplan_apply_service_1 = require("../ami/dialplan-apply.service");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const conference_dialplan_util_1 = require("./conference-dialplan.util");
/** ConfBridge `type=bridge` rejects unknown keys — `allow` is not a bridge option. */
const BRIDGE_PROFILE_LINES = [
    'type=bridge',
    'video_mode=sfu',
    'enable_events=yes',
    'record_file_timestamp=no',
];
let ConfbridgeStaticProfileService = ConfbridgeStaticProfileService_1 = class ConfbridgeStaticProfileService {
    amiService;
    dialplanApplyService;
    endpointsService;
    logger = new common_1.Logger(ConfbridgeStaticProfileService_1.name);
    constructor(amiService, dialplanApplyService, endpointsService) {
        this.amiService = amiService;
        this.dialplanApplyService = dialplanApplyService;
        this.endpointsService = endpointsService;
    }
    async onApplicationBootstrap() {
        if (conference_dialplan_util_1.CONFERENCE_PLATFORM_CODECS.length === 0) {
            throw new Error('CONFERENCE_PLATFORM_CODECS is empty — refusing to provision krsk_conf_sfu without a video codec');
        }
        try {
            const config = await this.readConfig();
            const loaded = await this.isProfileLoaded();
            const staleAllow = this.configHasInvalidAllow(config, conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE);
            const missingEvents = loaded && !this.configHasEnableEvents(config, conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE);
            const timestampOn = loaded && !this.configHasRecordFileTimestampOff(config, conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE);
            if (loaded && !staleAllow && !missingEvents && !timestampOn) {
                this.logger.log(`Static ConfBridge profile ${conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE} already present`);
                return;
            }
            try {
                await this.dialplanApplyService.applyCategories('confbridge.conf', [
                    {
                        name: conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE,
                        lines: [...BRIDGE_PROFILE_LINES],
                    },
                ], { reload: false });
                await this.amiService.command('module reload app_confbridge.so');
                if (!(await this.isProfileLoaded())) {
                    this.logger.error(`Wrote ${conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE} but app_confbridge did not load it`);
                    return;
                }
                this.logger.log(`Provisioned static ConfBridge profile ${conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE}`);
            }
            catch (e) {
                this.logger.error(`Failed to provision ${conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE}: ${e?.message || e}`);
            }
        }
        finally {
            try {
                await this.endpointsService.backfillWebrtcVideo();
            }
            catch (e) {
                this.logger.error(`backfillWebrtcVideo failed: ${e?.message || e}`);
            }
        }
    }
    async readConfig() {
        try {
            return await this.amiService.action({
                action: 'GetConfig',
                filename: 'confbridge.conf',
            });
        }
        catch (e) {
            this.logger.error(`GetConfig confbridge.conf failed — treating as missing profile: ${e?.message || e}`);
            return null;
        }
    }
    async isProfileLoaded() {
        try {
            const raw = await this.amiService.command(`confbridge show profile bridge ${conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE}`);
            const text = this.commandText(raw);
            if (!text || /no conference bridge profile named/i.test(text)) {
                return false;
            }
            return text.includes(conference_dialplan_util_1.CONFBRIDGE_BRIDGE_PROFILE) || /video_mode/i.test(text);
        }
        catch {
            return false;
        }
    }
    commandText(raw) {
        if (typeof raw === 'string')
            return raw;
        if (raw && typeof raw === 'object') {
            const rec = raw;
            if (typeof rec.output === 'string')
                return rec.output;
            if (Array.isArray(rec.output))
                return rec.output.map(String).join('\n');
            if (typeof rec.content === 'string')
                return rec.content;
        }
        try {
            return JSON.stringify(raw ?? '');
        }
        catch {
            return '';
        }
    }
    configHasInvalidAllow(response, category) {
        if (!this.hasProfile(response, category))
            return false;
        return /allow\s*=/.test(JSON.stringify(response).toLowerCase());
    }
    configHasEnableEvents(response, category) {
        if (!this.hasProfile(response, category))
            return false;
        return /enable_events\s*=\s*yes/.test(JSON.stringify(response).toLowerCase());
    }
    configHasRecordFileTimestampOff(response, category) {
        if (!this.hasProfile(response, category))
            return false;
        return /record_file_timestamp\s*=\s*no/.test(JSON.stringify(response).toLowerCase());
    }
    hasProfile(response, category) {
        if (!response || typeof response !== 'object')
            return false;
        const record = response;
        for (const [key, value] of Object.entries(record)) {
            if (/^category-\d+$/i.test(key) && String(value) === category) {
                return true;
            }
            if (typeof value === 'string' && value.includes(`[${category}]`)) {
                return true;
            }
        }
        return JSON.stringify(response).includes(category);
    }
};
exports.ConfbridgeStaticProfileService = ConfbridgeStaticProfileService;
exports.ConfbridgeStaticProfileService = ConfbridgeStaticProfileService = ConfbridgeStaticProfileService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ami_service_1.AmiService,
        dialplan_apply_service_1.DialplanApplyService,
        endpoints_service_1.EndpointsService])
], ConfbridgeStaticProfileService);
//# sourceMappingURL=confbridge-static-profile.service.js.map