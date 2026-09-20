"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicemailModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_connectivity_module_1 = require("../ai-connectivity/ai-connectivity.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const notifications_module_1 = require("../notifications/notifications.module");
const reports_cdr_module_1 = require("../reports/cdr/reports-cdr.module");
const stt_engines_module_1 = require("../stt-engines/stt-engines.module");
const system_settings_module_1 = require("../system-settings/system-settings.module");
const voice_robots_module_1 = require("../voice-robots/voice-robots.module");
const llm_summary_service_1 = require("./llm-summary.service");
const voicemail_access_token_model_1 = require("./voicemail-access-token.model");
const voicemail_ai_adapter_1 = require("./voicemail-ai.adapter");
const voicemail_controller_1 = require("./voicemail.controller");
const voicemail_dialplan_controller_1 = require("./voicemail-dialplan.controller");
const voicemail_link_controller_1 = require("./voicemail-link.controller");
const voicemail_link_guard_1 = require("./voicemail-link.guard");
const voicemail_message_model_1 = require("./voicemail-message.model");
const voicemail_scanner_service_1 = require("./voicemail-scanner.service");
const voicemail_service_1 = require("./voicemail.service");
let VoicemailModule = class VoicemailModule {
};
exports.VoicemailModule = VoicemailModule;
exports.VoicemailModule = VoicemailModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([voicemail_message_model_1.VoicemailMessage, voicemail_access_token_model_1.VoicemailAccessToken]),
            system_settings_module_1.SystemSettingsModule,
            notifications_module_1.NotificationsModule,
            reports_cdr_module_1.ReportsCdrModule,
            stt_engines_module_1.SttEnginesModule,
            voice_robots_module_1.VoiceRobotsModule,
            ai_connectivity_module_1.AiConnectivityModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [voicemail_dialplan_controller_1.VoicemailDialplanController, voicemail_link_controller_1.VoicemailLinkController, voicemail_controller_1.VoicemailController],
        providers: [
            voicemail_service_1.VoicemailService,
            voicemail_link_guard_1.VoicemailLinkGuard,
            voicemail_scanner_service_1.VoicemailScannerService,
            llm_summary_service_1.LlmSummaryService,
            voicemail_ai_adapter_1.VoicemailAiAdapter,
        ],
        exports: [voicemail_service_1.VoicemailService, voicemail_scanner_service_1.VoicemailScannerService],
    })
], VoicemailModule);
//# sourceMappingURL=voicemail.module.js.map