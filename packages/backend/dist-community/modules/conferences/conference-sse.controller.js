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
var ConferenceSseController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceSseController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
const conference_participant_dto_1 = require("./dto/conference-participant.dto");
const SSE_HEARTBEAT_MS = 15_000;
let ConferenceSseController = ConferenceSseController_1 = class ConferenceSseController {
    roomsService;
    stateService;
    logger = new common_1.Logger(ConferenceSseController_1.name);
    constructor(roomsService, stateService) {
        this.roomsService = roomsService;
        this.stateService = stateService;
    }
    events(req, roomUid) {
        return (0, rxjs_1.from)(this.roomsService.assertLiveRoomAccess(roomUid, req.user)).pipe((0, rxjs_1.switchMap)(() => {
            this.logger.log(`Conference SSE opened: room ${roomUid} tenant ${req.user.vpbx_user_uid}`);
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
                this.logger.log(`Conference SSE closed: room ${roomUid} heartbeat stopped observers=${this.stateService.streamObserverCount(roomUid)}`);
            }));
        }));
    }
};
exports.ConferenceSseController = ConferenceSseController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Sse)(':room_uid/events'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", rxjs_1.Observable)
], ConferenceSseController.prototype, "events", null);
exports.ConferenceSseController = ConferenceSseController = ConferenceSseController_1 = __decorate([
    (0, common_1.Controller)('conferences'),
    __metadata("design:paramtypes", [conference_rooms_service_1.ConferenceRoomsService,
        conference_state_service_1.ConferenceStateService])
], ConferenceSseController);
//# sourceMappingURL=conference-sse.controller.js.map