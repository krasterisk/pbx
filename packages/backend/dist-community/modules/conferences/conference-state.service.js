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
var ConferenceStateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceStateService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const sequelize_1 = require("@nestjs/sequelize");
const rxjs_1 = require("rxjs");
const conference_room_model_1 = require("./models/conference-room.model");
const conference_entry_policy_util_1 = require("./conference-entry-policy.util");
const conference_roles_util_1 = require("./conference-roles.util");
const conference_participant_dto_1 = require("./dto/conference-participant.dto");
/** asterisk-manager lowercases AMI headers — accept both casings. */
function amiString(evt, ...names) {
    const lower = new Map();
    for (const [key, value] of Object.entries(evt ?? {})) {
        lower.set(key.toLowerCase(), value);
    }
    for (const name of names) {
        const value = lower.get(name.toLowerCase());
        if (value != null && String(value).trim() !== '')
            return String(value);
    }
    return '';
}
let ConferenceStateService = ConferenceStateService_1 = class ConferenceStateService {
    moduleRef;
    logger = new common_1.Logger(ConferenceStateService_1.name);
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    rooms = new Map();
    streams = new Map();
    streamObservers = new Map();
    lastSignalAt = new Map();
    conferenceByName = new Map();
    conferenceByRoom = new Map();
    roomRights = new Map();
    liveGrants = new Map();
    rememberedNames = new Map();
    recordingByRoom = new Map();
    hydrating = new Map();
    registerRoom(room) {
        const conference = `conf${room.number}_${room.user_uid}`;
        const entry = {
            roomUid: room.uid,
            number: room.number,
            vpbx: room.user_uid,
            conference,
            entryPolicy: (0, conference_entry_policy_util_1.conferenceEntryPolicy)(room),
        };
        this.conferenceByName.set(conference, entry);
        this.conferenceByRoom.set(room.uid, entry);
    }
    setRoomRights(roomUid, rights) {
        this.roomRights.set(roomUid, {
            ownerRef: rights.ownerRef,
            moderatorRefs: [...rights.moderatorRefs],
        });
    }
    grantRole(roomUid, participantRef, role) {
        const participant = this.findLiveParticipant(roomUid, participantRef);
        if (!participant)
            return;
        if (participant.role === 'owner' || role === 'participant')
            return;
        const grants = this.grantsFor(roomUid);
        grants.set(participant.channel, role);
        if (participant.callerIdNum)
            grants.set(participant.callerIdNum, role);
        grants.set(participantRef, role);
        participant.role = role;
        this.emit(roomUid, 'roleGrant');
    }
    revokeRole(roomUid, participantRef) {
        const participant = this.findLiveParticipant(roomUid, participantRef);
        const grants = this.liveGrants.get(roomUid);
        grants?.delete(participantRef);
        if (participant) {
            grants?.delete(participant.channel);
            if (participant.callerIdNum)
                grants?.delete(participant.callerIdNum);
            participant.role = this.roleFromSettings(roomUid, participant.callerIdNum);
            this.emit(roomUid, 'roleRevoke');
        }
    }
    getGrantedRole(roomUid, participantRef) {
        return this.liveGrants.get(roomUid)?.get(participantRef);
    }
    getLiveGrants(roomUid) {
        return [...(this.liveGrants.get(roomUid)?.entries() ?? [])].map(([participantRef, role]) => ({
            participantRef,
            role,
        }));
    }
    findLiveParticipant(roomUid, participantRef) {
        return this.getSnapshot(roomUid).participants.find((item) => item.channel === participantRef || item.callerIdNum === participantRef);
    }
    getSnapshot(roomUid) {
        const participants = [...(this.rooms.get(roomUid)?.values() ?? [])].sort((a, b) => {
            if (a.joinedAt !== b.joinedAt)
                return a.joinedAt - b.joinedAt;
            return a.channel.localeCompare(b.channel);
        });
        return {
            roomUid,
            conference: this.conferenceByRoom.get(roomUid)?.conference ?? null,
            participants,
            waitingForModerator: this.computeWaitingForModerator(roomUid, participants),
            recording: this.recordingByRoom.get(roomUid) ?? false,
        };
    }
    setRecording(roomUid, value) {
        if (value)
            this.recordingByRoom.set(roomUid, true);
        else
            this.recordingByRoom.delete(roomUid);
        this.emit(roomUid, 'recording');
    }
    getEventStream(roomUid) {
        const subject = this.subjectFor(roomUid);
        return new rxjs_1.Observable((subscriber) => {
            this.streamObservers.set(roomUid, (this.streamObservers.get(roomUid) ?? 0) + 1);
            const sub = subject.subscribe(subscriber);
            return () => {
                sub.unsubscribe();
                const next = (this.streamObservers.get(roomUid) ?? 1) - 1;
                if (next <= 0)
                    this.streamObservers.delete(roomUid);
                else
                    this.streamObservers.set(roomUid, next);
            };
        });
    }
    streamObserverCount(roomUid) {
        return this.streamObservers.get(roomUid) ?? 0;
    }
    getActiveRoomUids() {
        return [...this.rooms.entries()]
            .filter(([, members]) => members.size > 0)
            .map(([roomUid]) => roomUid);
    }
    getLiveChannelPairs(roomUid) {
        return this.getSnapshot(roomUid).participants.map((item) => ({
            participantRef: item.callerIdNum || item.channel,
            channel: item.channel,
        }));
    }
    getRoomIdentity(roomUid) {
        const cached = this.conferenceByRoom.get(roomUid);
        if (!cached)
            return null;
        return { number: cached.number, vpbx: cached.vpbx };
    }
    isStale(channel, thresholdMs) {
        const last = this.lastSignalAt.get(channel);
        if (last == null)
            return false;
        return Date.now() - last > thresholdMs;
    }
    /** Refresh last-seen for a channel still present in ConfbridgeList (CR-02). */
    refreshSignal(channel) {
        if (!channel)
            return;
        this.touch(channel);
    }
    handleJoin(evt) {
        const channel = amiString(evt, 'Channel');
        if (!channel)
            return;
        const resolved = this.resolveRoom(evt);
        if (resolved) {
            return this.applyJoin(resolved, evt, channel);
        }
        return this.hydrateRoom(evt).then((entry) => {
            if (entry)
                return this.applyJoin(entry, evt, channel);
        });
    }
    handleLeave(evt) {
        const channel = amiString(evt, 'Channel');
        if (!channel)
            return;
        const resolved = this.resolveRoom(evt);
        if (resolved) {
            return this.applyLeave(resolved, channel, evt);
        }
        return this.hydrateRoom(evt).then((entry) => {
            if (entry)
                return this.applyLeave(entry, channel, evt);
        });
    }
    applyJoin(resolved, evt, channel) {
        const members = this.membersFor(resolved.roomUid);
        const callerIdNum = amiString(evt, 'CallerIDNum');
        const remembered = this.rememberedNames.get(resolved.roomUid)?.get(callerIdNum);
        members.set(channel, {
            channel,
            callerIdNum,
            role: this.resolveJoinRole(resolved.roomUid, evt),
            talking: false,
            muted: false,
            video: false,
            joinedAt: Date.now(),
            ...(remembered ? { displayName: remembered } : {}),
        });
        this.touch(channel);
        this.emit(resolved.roomUid, 'participantJoin');
        return this.persistJoin(resolved, evt);
    }
    async persistJoin(resolved, evt) {
        if (!this.moduleRef)
            return;
        try {
            const meetings = this.moduleRef.get('ConferenceMeetingsService', { strict: false });
            if (!meetings?.beginMeeting)
                return;
            const result = await meetings.beginMeeting(resolved.roomUid, resolved.vpbx, evt);
            const mode = result?.room?.record_mode;
            if (!result?.isFirstJoin || (mode !== 'auto' && mode !== 'both'))
                return;
            const recording = this.moduleRef.get('ConferenceRecordingService', { strict: false });
            if (!recording?.startForMeeting)
                return;
            await recording.startForMeeting(result.room, result.meeting, {
                vpbx_user_uid: resolved.vpbx,
            });
        }
        catch (e) {
            this.logger.error(`Meeting persist failed for room ${resolved.roomUid}: ${e?.message || e}`);
        }
    }
    applyLeave(resolved, channel, evt) {
        const members = this.rooms.get(resolved.roomUid);
        if (!members?.has(channel))
            return;
        members.delete(channel);
        this.lastSignalAt.delete(channel);
        const emptied = members.size === 0;
        if (emptied) {
            this.rooms.delete(resolved.roomUid);
            this.liveGrants.delete(resolved.roomUid);
            this.rememberedNames.delete(resolved.roomUid);
        }
        this.emit(resolved.roomUid, 'participantLeave');
        const persist = this.persistLeave(resolved, channel, evt, emptied);
        if (emptied) {
            return persist.then(() => this.invokeCollectIfEmpty(resolved.roomUid));
        }
        return persist;
    }
    async persistLeave(resolved, channel, evt, emptied) {
        if (!this.moduleRef)
            return;
        try {
            const meetings = this.moduleRef.get('ConferenceMeetingsService', { strict: false });
            const uniqueid = evt ? amiString(evt, 'Uniqueid', 'uniqueid') : '';
            const callerIdNum = evt ? amiString(evt, 'CallerIDNum') : '';
            if (meetings?.markParticipantLeft) {
                await meetings.markParticipantLeft(resolved.roomUid, { uniqueid, channel, callerIdNum });
            }
            if (!emptied)
                return;
            if (meetings?.endMeeting) {
                await meetings.endMeeting(resolved.roomUid);
            }
            const recording = this.moduleRef.get('ConferenceRecordingService', { strict: false });
            if (recording?.stopForRoom) {
                await recording.stopForRoom(resolved.roomUid, { vpbx_user_uid: resolved.vpbx });
            }
        }
        catch (e) {
            this.logger.error(`Meeting leave persist failed for room ${resolved.roomUid}: ${e?.message || e}`);
        }
    }
    hydrateRoom(evt) {
        const conference = amiString(evt, 'Conference').trim();
        if (!conference)
            return Promise.resolve(null);
        const cached = this.conferenceByName.get(conference);
        if (cached)
            return Promise.resolve(cached);
        const pending = this.hydrating.get(conference);
        if (pending)
            return pending;
        const task = this.loadRoomFromDb(conference).finally(() => {
            this.hydrating.delete(conference);
        });
        this.hydrating.set(conference, task);
        return task;
    }
    async loadRoomFromDb(conference) {
        const parsed = this.parseConferenceName(conference);
        if (!parsed || !this.moduleRef)
            return null;
        let model;
        try {
            model = this.moduleRef.get((0, sequelize_1.getModelToken)(conference_room_model_1.ConferenceRoom), { strict: false });
        }
        catch {
            return null;
        }
        if (!model?.findOne)
            return null;
        const room = await model.findOne({
            where: { number: parsed.number, user_uid: parsed.vpbx },
        });
        if (!room)
            return null;
        this.registerRoom(room);
        return (this.conferenceByName.get(`conf${room.number}_${room.user_uid}`) ??
            this.conferenceByName.get(conference) ??
            null);
    }
    handleTalking(evt) {
        const participant = this.findParticipant(evt);
        if (!participant)
            return;
        const talking = amiString(evt, 'TalkingStatus').toLowerCase();
        participant.state.talking = talking === 'on' || talking === 'yes' || talking === 'true';
        this.touch(participant.state.channel);
        this.emit(participant.roomUid, 'participantTalking');
    }
    handleMute(evt) {
        const participant = this.findParticipant(evt);
        if (!participant)
            return;
        participant.state.muted = true;
        this.touch(participant.state.channel);
        this.emit(participant.roomUid, 'participantMute');
    }
    handleUnmute(evt) {
        const participant = this.findParticipant(evt);
        if (!participant)
            return;
        participant.state.muted = false;
        this.touch(participant.state.channel);
        this.emit(participant.roomUid, 'participantUnmute');
    }
    setVideoState(roomUid, participantRef, enabled) {
        const participant = this.findLiveParticipant(roomUid, participantRef);
        if (!participant)
            return;
        if (participant.video === enabled)
            return;
        participant.video = enabled;
        this.emit(roomUid, 'participantVideo');
    }
    rememberDisplayName(roomUid, sipId, name) {
        const ref = String(sipId ?? '').trim();
        if (!ref)
            return;
        let names = this.rememberedNames.get(roomUid);
        if (!names) {
            names = new Map();
            this.rememberedNames.set(roomUid, names);
        }
        names.set(ref, (0, conference_participant_dto_1.truncateDisplayName)(String(name ?? '')));
    }
    setDisplayName(roomUid, participantRef, name) {
        const participant = this.findLiveParticipant(roomUid, participantRef);
        if (!participant)
            return;
        participant.displayName = (0, conference_participant_dto_1.truncateDisplayName)(String(name ?? ''));
        this.emit(roomUid, 'participantDisplayName');
    }
    resolveJoinRole(roomUid, evt) {
        const callerRef = amiString(evt, 'CallerIDNum').trim();
        const channel = amiString(evt, 'Channel');
        if (callerRef) {
            return this.roleFromSettings(roomUid, callerRef);
        }
        return (this.getGrantedRole(roomUid, channel) ??
            (0, conference_roles_util_1.roleFromConfbridgeFlags)({
                Admin: amiString(evt, 'Admin'),
                MarkedUser: amiString(evt, 'MarkedUser'),
            }));
    }
    computeWaitingForModerator(roomUid, participants) {
        const policy = this.conferenceByRoom.get(roomUid)?.entryPolicy;
        if (!policy?.requiresWaitMarked)
            return false;
        return !participants.some((item) => conference_roles_util_1.CONFBRIDGE_ROLE_FLAGS[item.role].marked);
    }
    roleFromSettings(roomUid, callerRef) {
        const rights = this.roomRights.get(roomUid) ?? { ownerRef: null, moderatorRefs: [] };
        return (0, conference_roles_util_1.resolveRoleForCaller)(callerRef, {
            ...rights,
            liveGrants: this.getLiveGrants(roomUid),
        });
    }
    grantsFor(roomUid) {
        let grants = this.liveGrants.get(roomUid);
        if (!grants) {
            grants = new Map();
            this.liveGrants.set(roomUid, grants);
        }
        return grants;
    }
    resolveRoom(evt) {
        const conference = amiString(evt, 'Conference').trim();
        if (!conference)
            return null;
        const cached = this.conferenceByName.get(conference);
        if (cached)
            return cached;
        const parsed = this.parseConferenceName(conference);
        if (!parsed)
            return null;
        const rebuilt = `conf${parsed.number}_${parsed.vpbx}`;
        return this.conferenceByName.get(rebuilt) ?? null;
    }
    parseConferenceName(conference) {
        if (!conference.startsWith('conf'))
            return null;
        const rest = conference.slice('conf'.length);
        const split = rest.lastIndexOf('_');
        if (split <= 0)
            return null;
        const number = rest.slice(0, split);
        const vpbx = Number(rest.slice(split + 1));
        if (!number || !Number.isFinite(vpbx))
            return null;
        return { number, vpbx };
    }
    membersFor(roomUid) {
        let members = this.rooms.get(roomUid);
        if (!members) {
            members = new Map();
            this.rooms.set(roomUid, members);
        }
        return members;
    }
    findParticipant(evt) {
        const resolved = this.resolveRoom(evt);
        const channel = amiString(evt, 'Channel');
        if (!resolved || !channel)
            return null;
        const state = this.rooms.get(resolved.roomUid)?.get(channel);
        if (!state)
            return null;
        return { roomUid: resolved.roomUid, state };
    }
    subjectFor(roomUid) {
        let subject = this.streams.get(roomUid);
        if (!subject) {
            subject = new rxjs_1.Subject();
            this.streams.set(roomUid, subject);
        }
        return subject;
    }
    emit(roomUid, type) {
        const event = {
            type,
            roomUid,
            data: this.getSnapshot(roomUid),
        };
        this.subjectFor(roomUid).next(event);
    }
    touch(channel) {
        this.lastSignalAt.set(channel, Date.now());
    }
    async invokeCollectIfEmpty(roomUid) {
        try {
            const ephemeral = this.moduleRef?.get('ConferenceEphemeralService', { strict: false });
            await ephemeral?.collectIfEmpty(roomUid);
        }
        catch (e) {
            this.logger.error(`Ephemeral collect failed for room ${roomUid}: ${e?.message || e}`);
        }
    }
};
exports.ConferenceStateService = ConferenceStateService;
exports.ConferenceStateService = ConferenceStateService = ConferenceStateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], ConferenceStateService);
//# sourceMappingURL=conference-state.service.js.map