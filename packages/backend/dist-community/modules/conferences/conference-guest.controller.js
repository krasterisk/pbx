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
var ConferenceGuestController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceGuestController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const rxjs_1 = require("rxjs");
const conference_guest_service_1 = require("./conference-guest.service");
const conference_guest_token_guard_1 = require("./conference-guest-token.guard");
const conference_state_service_1 = require("./conference-state.service");
const conference_display_name_dto_1 = require("./dto/conference-display-name.dto");
const conference_guest_join_dto_1 = require("./dto/conference-guest-join.dto");
const conference_participant_dto_1 = require("./dto/conference-participant.dto");
const SSE_HEARTBEAT_MS = 15_000;
let ConferenceGuestController = ConferenceGuestController_1 = class ConferenceGuestController {
    guestService;
    stateService;
    logger = new common_1.Logger(ConferenceGuestController_1.name);
    constructor(guestService, stateService) {
        this.guestService = guestService;
        this.stateService = stateService;
    }
    getMeta(req) {
        return this.guestService.getMeta(req.user);
    }
    join(req, dto) {
        return this.guestService.join(req.user, dto);
    }
    leave(req) {
        return this.guestService.leave(req.user);
    }
    setDisplayName(req, dto) {
        return this.guestService.setDisplayName(req.user, dto);
    }
    ingestTelemetry(req, body) {
        return this.guestService.ingestTelemetry(req.user, body ?? {});
    }
    events(req) {
        const roomUid = req.user.roomUid;
        this.logger.log(`Conference guest SSE opened: room ${roomUid}`);
        const snapshot = this.stateService.getSnapshot(roomUid);
        const events$ = this.stateService.getEventStream(roomUid).pipe((0, rxjs_1.startWith)({
            type: 'fullSnapshot',
            roomUid,
            data: snapshot,
        }), (0, rxjs_1.map)((event) => ({
            data: JSON.stringify((0, conference_participant_dto_1.toConferenceRoomStateDto)(event.data)),
            type: event.type,
            id: String(Date.now()),
        })));
        const closed$ = new rxjs_1.Observable((subscriber) => {
            const target = req;
            if (typeof target.on !== 'function')
                return undefined;
            const onClose = () => {
                subscriber.next();
                subscriber.complete();
            };
            target.on('close', onClose);
            return () => {
                if (typeof target.off === 'function')
                    target.off('close', onClose);
                else if (typeof target.removeListener === 'function')
                    target.removeListener('close', onClose);
            };
        });
        const heartbeat$ = (0, rxjs_1.interval)(SSE_HEARTBEAT_MS).pipe((0, rxjs_1.takeUntil)(closed$), (0, rxjs_1.map)(() => ({
            data: '',
            type: 'heartbeat',
            id: undefined,
        })));
        return (0, rxjs_1.merge)(events$, heartbeat$).pipe((0, rxjs_1.takeUntil)(closed$), (0, rxjs_1.finalize)(() => {
            this.logger.log(`Conference guest SSE closed: room ${roomUid} heartbeat stopped observers=${this.stateService.streamObserverCount(roomUid)}`);
        }));
    }
};
exports.ConferenceGuestController = ConferenceGuestController;
__decorate([
    (0, common_1.UseGuards)(conference_guest_token_guard_1.ConferenceGuestTokenGuard),
    (0, common_1.Get)(':token'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConferenceGuestController.prototype, "getMeta", null);
__decorate([
    (0, common_1.UseGuards)(conference_guest_token_guard_1.ConferenceGuestTokenGuard),
    (0, common_1.Post)(':token/join'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, conference_guest_join_dto_1.ConferenceGuestJoinDto]),
    __metadata("design:returntype", void 0)
], ConferenceGuestController.prototype, "join", null);
__decorate([
    (0, common_1.UseGuards)(conference_guest_token_guard_1.ConferenceGuestTokenGuard),
    (0, common_1.Post)(':token/leave'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConferenceGuestController.prototype, "leave", null);
__decorate([
    (0, common_1.UseGuards)(conference_guest_token_guard_1.ConferenceGuestTokenGuard),
    (0, common_1.Post)(':token/me/display-name'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, conference_display_name_dto_1.ConferenceDisplayNameDto]),
    __metadata("design:returntype", void 0)
], ConferenceGuestController.prototype, "setDisplayName", null);
__decorate([
    (0, common_1.UseGuards)(conference_guest_token_guard_1.ConferenceGuestTokenGuard),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Post)(':token/telemetry'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ConferenceGuestController.prototype, "ingestTelemetry", null);
__decorate([
    (0, common_1.UseGuards)(conference_guest_token_guard_1.ConferenceGuestTokenGuard),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Sse)(':token/events'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], ConferenceGuestController.prototype, "events", null);
exports.ConferenceGuestController = ConferenceGuestController = ConferenceGuestController_1 = __decorate([
    (0, common_1.Controller)('conferences/guest'),
    __metadata("design:paramtypes", [conference_guest_service_1.ConferenceGuestService,
        conference_state_service_1.ConferenceStateService])
], ConferenceGuestController);
//# sourceMappingURL=conference-guest.controller.js.map