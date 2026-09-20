"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMediaOptions = exports.serializeMediaOptions = exports.MediaOptionsDto = exports.validateAction = exports.DirectoryLookupParamsDto = exports.CallValueSourceDto = exports.IsValueSourceConstraint = exports.ValueSourceDto = exports.ToQueueParamsDto = exports.ACTION_PARAM_DTO = void 0;
exports.resolveParamsDto = resolveParamsDto;
const address_params_dto_1 = require("./address.params.dto");
const control_params_dto_1 = require("./control.params.dto");
const integration_params_dto_1 = require("./integration.params.dto");
const media_params_dto_1 = require("./media.params.dto");
const directory_lookup_params_dto_1 = require("./directory-lookup.params.dto");
/**
 * Per-type params DTO registry (D-09).
 * `null` is allowed only for types that have no params at all: nonempty params
 * must not fail, and unknown keys are stripped by whitelist when a DTO exists.
 */
exports.ACTION_PARAM_DTO = {
    totrunk: address_params_dto_1.ToTrunkParamsDto,
    toexten: address_params_dto_1.ToExtenParamsDto,
    toqueue: address_params_dto_1.ToQueueParamsDto,
    togroup: address_params_dto_1.ToGroupParamsDto,
    tolist: address_params_dto_1.ToListParamsDto,
    toivr: address_params_dto_1.ToIvrParamsDto,
    toroute: address_params_dto_1.ToRouteParamsDto,
    playback: media_params_dto_1.PlaybackParamsDto,
    notify: integration_params_dto_1.NotifyParamsDto,
    callerid: control_params_dto_1.CallerIdParamsDto,
    voicemail: address_params_dto_1.VoicemailParamsDto,
    text2speech: media_params_dto_1.Text2SpeechParamsDto,
    voicerobot: media_params_dto_1.VoiceRobotParamsDto,
    ai_voice_robot: media_params_dto_1.AiVoiceRobotParamsDto,
    webhook: control_params_dto_1.WebhookParamsDto,
    confbridge: address_params_dto_1.ConfBridgeParamsDto,
    cmd: control_params_dto_1.CmdParamsDto,
    label: control_params_dto_1.LabelParamsDto,
    goto: control_params_dto_1.GotoParamsDto,
    schedule: control_params_dto_1.ScheduleParamsDto,
    http_request: integration_params_dto_1.HttpRequestParamsDto,
    collect_input: integration_params_dto_1.CollectInputParamsDto,
    hangup: control_params_dto_1.HangupParamsDto,
    directory_lookup: directory_lookup_params_dto_1.DirectoryLookupParamsDto,
    callback: integration_params_dto_1.CallbackParamsDto,
};
function resolveParamsDto(type) {
    if (!Object.prototype.hasOwnProperty.call(exports.ACTION_PARAM_DTO, type)) {
        throw new Error(`ACTION_PARAM_DTO is missing an entry for ${type}`);
    }
    return exports.ACTION_PARAM_DTO[type];
}
var address_params_dto_2 = require("./address.params.dto");
Object.defineProperty(exports, "ToQueueParamsDto", { enumerable: true, get: function () { return address_params_dto_2.ToQueueParamsDto; } });
var value_source_dto_1 = require("./value-source.dto");
Object.defineProperty(exports, "ValueSourceDto", { enumerable: true, get: function () { return value_source_dto_1.ValueSourceDto; } });
Object.defineProperty(exports, "IsValueSourceConstraint", { enumerable: true, get: function () { return value_source_dto_1.IsValueSourceConstraint; } });
Object.defineProperty(exports, "CallValueSourceDto", { enumerable: true, get: function () { return value_source_dto_1.CallValueSourceDto; } });
var directory_lookup_params_dto_2 = require("./directory-lookup.params.dto");
Object.defineProperty(exports, "DirectoryLookupParamsDto", { enumerable: true, get: function () { return directory_lookup_params_dto_2.DirectoryLookupParamsDto; } });
Object.defineProperty(exports, "validateAction", { enumerable: true, get: function () { return directory_lookup_params_dto_2.validateAction; } });
var media_params_dto_2 = require("./media.params.dto");
Object.defineProperty(exports, "MediaOptionsDto", { enumerable: true, get: function () { return media_params_dto_2.MediaOptionsDto; } });
Object.defineProperty(exports, "serializeMediaOptions", { enumerable: true, get: function () { return media_params_dto_2.serializeMediaOptions; } });
Object.defineProperty(exports, "parseMediaOptions", { enumerable: true, get: function () { return media_params_dto_2.parseMediaOptions; } });
//# sourceMappingURL=index.js.map