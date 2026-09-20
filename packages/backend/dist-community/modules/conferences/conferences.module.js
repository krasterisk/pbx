"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferencesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const ami_module_1 = require("../ami/ami.module");
const endpoints_module_1 = require("../endpoints/endpoints.module");
const logger_module_1 = require("../logger/logger.module");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const user_model_1 = require("../users/user.model");
const reports_cdr_module_1 = require("../reports/cdr/reports-cdr.module");
const system_settings_module_1 = require("../system-settings/system-settings.module");
const conference_capacity_service_1 = require("./conference-capacity.service");
const conference_invite_service_1 = require("./conference-invite.service");
const conference_meetings_controller_1 = require("./conference-meetings.controller");
const conference_meetings_service_1 = require("./conference-meetings.service");
const conference_recording_controller_1 = require("./conference-recording.controller");
const conference_recording_service_1 = require("./conference-recording.service");
const confbridge_static_profile_service_1 = require("./confbridge-static-profile.service");
const conference_ephemeral_service_1 = require("./conference-ephemeral.service");
const conference_guest_controller_1 = require("./conference-guest.controller");
const conference_guest_service_1 = require("./conference-guest.service");
const conference_guest_token_guard_1 = require("./conference-guest-token.guard");
const conference_guest_webrtc_controller_1 = require("./conference-guest-webrtc.controller");
const conference_moderation_controller_1 = require("./conference-moderation.controller");
const conference_moderation_service_1 = require("./conference-moderation.service");
const conference_participant_controller_1 = require("./conference-participant.controller");
const conference_rooms_controller_1 = require("./conference-rooms.controller");
const conferences_ai_adapter_1 = require("./conferences-ai.adapter");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_sse_controller_1 = require("./conference-sse.controller");
const conference_stale_channel_sweeper_service_1 = require("./conference-stale-channel-sweeper.service");
const conference_state_service_1 = require("./conference-state.service");
const conference_telemetry_service_1 = require("./conference-telemetry.service");
const conference_guest_token_model_1 = require("./models/conference-guest-token.model");
const conference_meeting_participant_model_1 = require("./models/conference-meeting-participant.model");
const conference_meeting_model_1 = require("./models/conference-meeting.model");
const conference_room_moderator_model_1 = require("./models/conference-room-moderator.model");
const conference_room_model_1 = require("./models/conference-room.model");
let ConferencesModule = class ConferencesModule {
};
exports.ConferencesModule = ConferencesModule;
exports.ConferencesModule = ConferencesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                conference_room_model_1.ConferenceRoom,
                conference_room_moderator_model_1.ConferenceRoomModerator,
                conference_guest_token_model_1.ConferenceGuestToken,
                conference_meeting_model_1.ConferenceMeeting,
                conference_meeting_participant_model_1.ConferenceMeetingParticipant,
                user_model_1.User,
                ps_endpoint_model_1.PsEndpoint,
            ]),
            ami_module_1.AmiModule,
            ai_platform_module_1.AiPlatformModule,
            logger_module_1.LoggerModule,
            endpoints_module_1.EndpointsModule,
            system_settings_module_1.SystemSettingsModule,
            reports_cdr_module_1.ReportsCdrModule,
        ],
        controllers: [
            conference_guest_webrtc_controller_1.ConferenceGuestWebrtcController,
            conference_guest_controller_1.ConferenceGuestController,
            conference_meetings_controller_1.ConferenceMeetingsController,
            conference_rooms_controller_1.ConferenceRoomsController,
            conference_moderation_controller_1.ConferenceModerationController,
            conference_participant_controller_1.ConferenceParticipantController,
            conference_sse_controller_1.ConferenceSseController,
            conference_recording_controller_1.ConferenceRecordingController,
        ],
        providers: [
            conference_rooms_service_1.ConferenceRoomsService,
            conferences_ai_adapter_1.ConferencesAiAdapter,
            conference_meetings_service_1.ConferenceMeetingsService,
            {
                provide: 'ConferenceMeetingsService',
                useExisting: conference_meetings_service_1.ConferenceMeetingsService,
            },
            conference_recording_service_1.ConferenceRecordingService,
            {
                provide: 'ConferenceRecordingService',
                useExisting: conference_recording_service_1.ConferenceRecordingService,
            },
            conference_capacity_service_1.ConferenceCapacityService,
            conference_invite_service_1.ConferenceInviteService,
            conference_guest_service_1.ConferenceGuestService,
            conference_guest_token_guard_1.ConferenceGuestTokenGuard,
            conference_moderation_service_1.ConferenceModerationService,
            conference_state_service_1.ConferenceStateService,
            {
                provide: 'ConferenceStateService',
                useExisting: conference_state_service_1.ConferenceStateService,
            },
            conference_telemetry_service_1.ConferenceTelemetryService,
            conference_ephemeral_service_1.ConferenceEphemeralService,
            {
                provide: 'ConferenceEphemeralService',
                useExisting: conference_ephemeral_service_1.ConferenceEphemeralService,
            },
            confbridge_static_profile_service_1.ConfbridgeStaticProfileService,
            conference_stale_channel_sweeper_service_1.ConferenceStaleChannelSweeperService,
        ],
        exports: [
            conference_rooms_service_1.ConferenceRoomsService,
            conference_capacity_service_1.ConferenceCapacityService,
            conference_state_service_1.ConferenceStateService,
            conference_ephemeral_service_1.ConferenceEphemeralService,
            conference_meetings_service_1.ConferenceMeetingsService,
            conference_recording_service_1.ConferenceRecordingService,
        ],
    })
], ConferencesModule);
//# sourceMappingURL=conferences.module.js.map