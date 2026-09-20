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
var CallCenterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterService = void 0;
/**
 * CallCenter Business Logic Service.
 *
 * Implements agent/supervisor actions by calling AMI commands
 * and updating the in-memory state store.
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ami_service_1 = require("../ami/ami.service");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_ami_service_1 = require("./callcenter-ami.service");
const callcenter_metrics_service_1 = require("./callcenter-metrics.service");
const callcenter_permissions_service_1 = require("./callcenter-permissions.service");
const logger_service_1 = require("../logger/logger.service");
const pause_reason_model_1 = require("./models/pause-reason.model");
const agent_session_model_1 = require("./models/agent-session.model");
const agent_event_model_1 = require("./models/agent-event.model");
const queue_call_model_1 = require("./models/queue-call.model");
const missed_call_model_1 = require("./models/missed-call.model");
const cc_contact_model_1 = require("./models/cc-contact.model");
const operator_settings_model_1 = require("./models/operator-settings.model");
const callcenter_settings_service_1 = require("./callcenter-settings.service");
const callcenter_access_list_service_1 = require("./callcenter-access-list.service");
const ami_error_util_1 = require("./ami-error.util");
const callcenter_shift_restore_service_1 = require("./callcenter-shift-restore.service");
const conference_ephemeral_service_1 = require("../conferences/conference-ephemeral.service");
const user_model_1 = require("../users/user.model");
const service_request_model_1 = require("../service-requests/service-request.model");
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
const sequelize_2 = require("sequelize");
const callcenter_presence_service_1 = require("./callcenter-presence.service");
const queue_model_1 = require("../queues/queue.model");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const call_group_model_1 = require("../call-groups/call-group.model");
const call_group_member_model_1 = require("../call-groups/call-group-member.model");
const callcenter_settings_service_2 = require("./callcenter-settings.service");
const shift_policy_types_1 = require("./models/shift-policy.types");
let CallCenterService = CallCenterService_1 = class CallCenterService {
    amiService;
    stateService;
    ccAmiService;
    metricsService;
    pauseReasonModel;
    sessionModel;
    agentEventModel;
    queueCallModel;
    missedCallModel;
    userModel;
    serviceRequestModel;
    settingsService;
    permissionsService;
    loggerService;
    queueModel;
    endpointModel;
    callGroupModel;
    callGroupMemberModel;
    presenceService;
    contactModel;
    operatorSettingsModel;
    accessListService;
    shiftRestore;
    conferenceEphemeralService;
    logger = new common_1.Logger(CallCenterService_1.name);
    /** Maps userId → active session uid */
    activeSessions = new Map();
    /** Active SSE panel connections per operator userId (idle policy). */
    panelConnections = new Map();
    constructor(amiService, stateService, ccAmiService, metricsService, pauseReasonModel, sessionModel, agentEventModel, queueCallModel, missedCallModel, userModel, serviceRequestModel, settingsService, permissionsService, loggerService, queueModel, endpointModel, callGroupModel, callGroupMemberModel, presenceService, contactModel, operatorSettingsModel, accessListService, shiftRestore, conferenceEphemeralService) {
        this.amiService = amiService;
        this.stateService = stateService;
        this.ccAmiService = ccAmiService;
        this.metricsService = metricsService;
        this.pauseReasonModel = pauseReasonModel;
        this.sessionModel = sessionModel;
        this.agentEventModel = agentEventModel;
        this.queueCallModel = queueCallModel;
        this.missedCallModel = missedCallModel;
        this.userModel = userModel;
        this.serviceRequestModel = serviceRequestModel;
        this.settingsService = settingsService;
        this.permissionsService = permissionsService;
        this.loggerService = loggerService;
        this.queueModel = queueModel;
        this.endpointModel = endpointModel;
        this.callGroupModel = callGroupModel;
        this.callGroupMemberModel = callGroupMemberModel;
        this.presenceService = presenceService;
        this.contactModel = contactModel;
        this.operatorSettingsModel = operatorSettingsModel;
        this.accessListService = accessListService;
        this.shiftRestore = shiftRestore;
        this.conferenceEphemeralService = conferenceEphemeralService;
    }
    // ─── Helpers ─────────────────────────────────────────────
    sessionKey(userUid, userId) {
        return `${userUid}:${userId}`;
    }
    /**
     * Queue member interfaces for a primary/WebRTC pair.
     * PJSIP/ew112_0 ↔ PJSIP/e112_0 — logout must remove both (stale SIP member otherwise remains).
     */
    static relatedQueueInterfaces(agentInterface) {
        const tech = agentInterface.includes('/')
            ? agentInterface.slice(0, agentInterface.indexOf('/') + 1)
            : 'PJSIP/';
        const sipId = agentInterface.includes('/')
            ? agentInterface.slice(agentInterface.indexOf('/') + 1)
            : agentInterface;
        const related = new Set([`PJSIP/${sipId}`, `${tech}${sipId}`, agentInterface]);
        const twin = (0, endpoint_ids_util_1.isWebrtcCompanion)(sipId) ? (0, endpoint_ids_util_1.primaryIdOf)(sipId) : (0, endpoint_ids_util_1.companionIdOf)(sipId);
        if (twin) {
            related.add(`PJSIP/${twin}`);
            related.add(`${tech}${twin}`);
        }
        return [...related];
    }
    /**
     * Block shift start when another operator is actually online on this extension
     * (same PJSIP id or primary↔WebRTC twin). Same user re-login is allowed.
     *
     * Open DB sessions of other users are NOT closed here — the supervisor must
     * force-logout; absence from RAM after Nest restart is not a finished shift.
     */
    async assertExtensionAvailable(_stateUid, agentInterface, userId) {
        const related = new Set(CallCenterService_1.relatedQueueInterfaces(agentInterface));
        const exten = (0, endpoint_ids_util_1.interfaceToExtension)(agentInterface) || (0, endpoint_ids_util_1.extractExtension)(agentInterface);
        const isSameExtension = (iface) => {
            if (related.has(iface))
                return true;
            const otherRelated = CallCenterService_1.relatedQueueInterfaces(iface);
            if (otherRelated.some((i) => related.has(i)))
                return true;
            const otherExt = (0, endpoint_ids_util_1.interfaceToExtension)(iface);
            return Boolean(exten && otherExt && otherExt === exten && !iface.startsWith('user:'));
        };
        const liveOccupant = this.stateService.getAllAgentsGlobal().find((agent) => {
            if (!agent.userId || agent.userId === userId)
                return false;
            if (agent.status === 'OFFLINE')
                return false;
            if (!agent.interface || agent.interface.startsWith('user:'))
                return false;
            return isSameExtension(agent.interface);
        });
        if (liveOccupant) {
            const name = (liveOccupant.name || '').trim() || `#${liveOccupant.userId}`;
            throw new common_1.ConflictException(`Номер ${exten || agentInterface} уже занят оператором ${name}. Завершите его смену или выберите другой номер.`);
        }
        try {
            const rows = await this.sessionModel.findAll({
                where: {
                    logout_time: null,
                    user_id: { [sequelize_2.Op.ne]: userId },
                    agent_interface: { [sequelize_2.Op.in]: [...related] },
                },
                attributes: ['user_id', 'agent_interface'],
            });
            if (rows.length > 0) {
                const otherId = Number(rows[0].user_id ?? rows[0].getDataValue?.('user_id'));
                let name = `#${otherId}`;
                try {
                    const user = await this.userModel.findOne({ where: { uniqueid: otherId } });
                    if (user) {
                        name =
                            String(user.getDataValue('name') || '').trim()
                                || String(user.getDataValue('login') || '').trim()
                                || name;
                    }
                }
                catch { /* ignore */ }
                throw new common_1.ConflictException(`Номер ${exten || agentInterface} занят открытой сменой оператора ${name}. `
                    + `Супервизор должен завершить эту смену (force-logout), прежде чем назначить номер другому.`);
            }
        }
        catch (err) {
            if (err instanceof common_1.ConflictException)
                throw err;
        }
    }
    /** Rebind in-memory session map after Nest restart / hydrate. */
    bindActiveSession(userUid, userId, sessionId) {
        this.activeSessions.set(this.sessionKey(userUid, userId), sessionId);
    }
    /**
     * Single exit for ending a shift — operator logout, supervisor force-logout,
     * re-login close of prior session, or system janitor policy.
     */
    async endShift(opts) {
        const { userId, reason } = opts;
        let userUid = opts.userUid;
        let agentInterface = opts.agentInterface || null;
        let sessionId = opts.sessionId ?? null;
        if (!sessionId) {
            const session = await this.sessionModel.findOne({
                where: { user_id: userId, logout_time: null },
                order: [['login_time', 'DESC']],
            });
            if (session) {
                sessionId = session.uid;
                userUid = Number(session.user_uid) || userUid;
                agentInterface = agentInterface || session.agent_interface;
            }
        }
        if (!agentInterface) {
            agentInterface = await this.resolveAgentInterface(userUid, userId);
        }
        if (!agentInterface) {
            if (sessionId) {
                await this.sessionModel.update({ logout_time: new Date(), close_reason: reason }, { where: { uid: sessionId, logout_time: null } });
                this.activeSessions.delete(this.sessionKey(userUid, userId));
            }
            return { success: true };
        }
        const agent = this.stateService.getAgent(userUid, agentInterface)
            || this.stateService.getAllAgentsGlobal().find((a) => a.userId === userId && a.interface === agentInterface);
        const stateUid = agent?.userUid ?? userUid;
        let sessionQueues = agent?.queues?.length ? [...agent.queues] : [];
        if (sessionQueues.length === 0 && sessionId) {
            try {
                const row = await this.sessionModel.findByPk(sessionId);
                const snap = row?.getDataValue('queues_snapshot');
                if (Array.isArray(snap))
                    sessionQueues = snap;
            }
            catch { /* ignore */ }
        }
        if (agent) {
            await this.ccAmiService.endTimedStatus(agent);
            if (agent.status === 'READY' && agent.statusSince) {
                const idleSec = Math.max(0, Math.round((Date.now() - new Date(agent.statusSince).getTime()) / 1000));
                if (idleSec > 0) {
                    await this.ccAmiService.incrementSessionTotals(userId, agentInterface, {
                        total_idle_time: idleSec,
                    });
                }
            }
        }
        await this.queueRemoveAll(sessionQueues, agentInterface);
        if (sessionId) {
            await this.sessionModel.update({ logout_time: new Date(), close_reason: reason }, { where: { uid: sessionId, logout_time: null } });
            this.activeSessions.delete(this.sessionKey(stateUid, userId));
            this.activeSessions.delete(this.sessionKey(userUid, userId));
            await this.ccAmiService.logAgentEvent({
                sessionId,
                userId,
                eventType: 'LOGOUT',
                userUid: stateUid,
                reason,
            });
        }
        this.stateService.removeAgent(stateUid, agentInterface);
        if (stateUid !== userUid) {
            this.stateService.removeAgent(userUid, agentInterface);
        }
        if (await this.shouldFreeExtenOnClose(stateUid)) {
            await this.clearUserExtension(userId, agentInterface);
        }
        this.logger.log(`Shift ended for user ${userId} (${agentInterface}): reason=${reason}`);
        return { success: true };
    }
    async shouldFreeExtenOnClose(userUid) {
        try {
            const settings = await this.settingsService.getTenantSettings(userUid);
            return settings?.shift_policy?.free_exten_on_close !== false;
        }
        catch {
            return shift_policy_types_1.DEFAULT_SHIFT_POLICY.free_exten_on_close;
        }
    }
    /** Persist shift extension for CDR / directory; exclusive within the tenant. */
    async claimUserExtension(userId, tenantUid, exten) {
        if (!exten)
            return;
        // Free the number from anyone else in this tenant (stale assignments after crash/logout bugs).
        await this.userModel.update({ exten: '' }, {
            where: {
                vpbx_user_uid: tenantUid,
                uniqueid: { [sequelize_2.Op.ne]: userId },
                exten,
            },
        });
        await this.userModel.update({ exten }, { where: { uniqueid: userId } });
    }
    async clearUserExtension(userId, agentInterface) {
        const exten = (0, endpoint_ids_util_1.interfaceToExtension)(agentInterface);
        if (!exten)
            return;
        try {
            await this.userModel.update({ exten: '' }, { where: { uniqueid: userId, exten } });
        }
        catch {
            /* ignore */
        }
    }
    async queueRemoveAll(queues, agentInterface) {
        const ifaces = CallCenterService_1.relatedQueueInterfaces(agentInterface);
        for (const queue of queues) {
            for (const iface of ifaces) {
                try {
                    await this.amiService.queueRemove(queue, iface);
                }
                catch (err) {
                    this.logger.warn(`Failed to remove ${iface} from queue ${queue}: ${err.message}`);
                }
            }
        }
    }
    /** Queue-suffix tenant where operator is online, else JWT vpbx (q700_0 vs vpbx=58). */
    resolveTenant(jwtUserUid, userId) {
        return this.stateService.findTenantForOnlineUser(userId) ?? jwtUserUid;
    }
    /**
     * Resolve the operator's live agent interface.
     * After Nest restart QueueMember preload leaves userId=0 until /agent/me —
     * fall back to the open DB session and rebind identity so hangup /
     * registration-state / click-to-call keep working.
     */
    async resolveAgentInterface(userUid, userId) {
        const tenant = this.resolveTenant(userUid, userId);
        const bound = this.stateService.getAllAgents(tenant).find((a) => a.userId === userId);
        if (bound?.interface)
            return bound.interface;
        const session = await this.sessionModel.findOne({
            where: { user_id: userId, logout_time: null },
            order: [['login_time', 'DESC']],
        });
        if (!session)
            return null;
        const stateUid = Number(session.user_uid);
        const iface = session.agent_interface;
        const existing = this.stateService.getAgent(stateUid, iface)
            || this.stateService.getAgent(tenant, iface);
        if (existing) {
            if (!existing.userId || existing.userId !== userId) {
                this.stateService.setAgent(existing.userUid, existing.interface, { userId });
            }
            return existing.interface;
        }
        this.stateService.setAgent(stateUid, iface, {
            userId,
            status: 'READY',
            queues: this.recoverAgentQueues(stateUid, iface),
            name: iface,
            loginTime: session.login_time,
        });
        return iface;
    }
    tenantFromQueues(queues) {
        for (const q of queues) {
            const t = callcenter_ami_service_1.CallCenterAmiService.parseQueueTenant(q);
            if (t != null)
                return t;
        }
        return null;
    }
    /** Transfer target must be a known agent interface/exten or queue in this tenant. */
    isTransferTargetAllowed(userUid, target) {
        const agents = this.stateService.getAllAgents(userUid);
        for (const agent of agents) {
            if (agent.interface === target)
                return true;
            const sipId = agent.interface.replace(/^PJSIP\//, '').replace(/^SIP\//, '');
            if (sipId === target)
                return true;
            // e110_0 / ew110_0 → "110"
            const extMatch = sipId.match(/^ew?(.+)_\d+$/);
            if (extMatch && extMatch[1] === target)
                return true;
        }
        const queues = this.stateService.getAllQueues(userUid);
        return queues.some(q => q.name === target);
    }
    // ─── Agent Actions ──────────────────────────────────────
    async agentLogin(agentInterface, queues, userUid, userId) {
        // In-memory + AMI events use queue suffix (q700_0 → 0), not necessarily JWT vpbx.
        const stateUid = this.tenantFromQueues(queues) ?? userUid;
        await this.assertExtensionAvailable(stateUid, agentInterface, userId);
        // Close any prior open sessions for this user (refresh / re-login)
        const prior = await this.sessionModel.findAll({
            where: { user_id: userId, logout_time: null },
        });
        for (const row of prior) {
            await this.endShift({
                userUid: Number(row.user_uid) || stateUid,
                userId,
                agentInterface: row.agent_interface,
                sessionId: row.uid,
                reason: 'RELOGIN',
            });
        }
        const softphoneMode = (0, endpoint_ids_util_1.isWebrtcCompanion)(agentInterface.replace(/^PJSIP\//, '').replace(/^SIP\//, ''))
            ? 'webrtc'
            : 'sip';
        // Create a session record
        const session = await this.sessionModel.create({
            user_id: userId,
            agent_interface: agentInterface,
            login_time: new Date(),
            user_uid: stateUid,
            last_status: 'READY',
            last_status_at: new Date(),
            last_status_origin: 'login',
            queues_snapshot: queues,
            softphone_mode: softphoneMode,
            panel_seen_at: new Date(),
        });
        this.activeSessions.set(this.sessionKey(stateUid, userId), session.uid);
        // Fresh shift — sinceLogin KPI counters start at 0 (sinceMidnight is untouched, D-11).
        this.metricsService.resetKpiSinceLogin(stateUid, agentInterface);
        // Get user display name; persist the shift extension for CDR / directory
        let displayName = agentInterface;
        try {
            const user = await this.userModel.findOne({ where: { uniqueid: userId } });
            if (user) {
                displayName = user.getDataValue('name') || user.getDataValue('login') || agentInterface;
                const exten = (0, endpoint_ids_util_1.interfaceToExtension)(agentInterface);
                if (exten) {
                    const tenantForUsers = Number(user.getDataValue('vpbx_user_uid')) || stateUid;
                    await this.claimUserExtension(userId, tenantForUsers, exten);
                }
            }
        }
        catch { /* ignore */ }
        // Add agent to queues via AMI; drop primary↔webrtc twin so stale members don't linger
        for (const queue of queues) {
            for (const twin of CallCenterService_1.relatedQueueInterfaces(agentInterface)) {
                if (twin === agentInterface)
                    continue;
                try {
                    await this.amiService.queueRemove(queue, twin);
                }
                catch {
                    /* ignore — twin may not be in queue */
                }
            }
            try {
                await this.amiService.queueAdd(queue, agentInterface);
            }
            catch (err) {
                this.logger.warn(`Failed to add ${agentInterface} to queue ${queue}: ${err.message}`);
            }
        }
        const settings = await this.settingsService.getOperatorSettings(stateUid, userId);
        // Update in-memory state (per-operator wrap-up timers loaded once at login)
        this.stateService.setAgent(stateUid, agentInterface, {
            status: 'READY',
            statusOrigin: 'login',
            name: displayName,
            queues,
            loginTime: new Date(),
            callsTaken: 0,
            callsMissed: 0,
            callsMade: 0,
            dialTarget: undefined,
            userId,
            wrapupTimeout: settings.wrapup_timeout,
            wrapupExtendStep: settings.wrapup_extend_step,
            wrapupAutosaveDraft: settings.wrapup_autosave_draft,
        });
        // Seed live queue rows so QueuesTab / snapshot have entries even before AMI
        // QueueParams arrives (AMI down / slow QueueStatus).
        for (const queueName of queues) {
            const existing = this.stateService.getQueue(stateUid, queueName);
            if (!existing) {
                let displayNameQ = queueName;
                try {
                    const row = await this.queueModel.findOne({
                        where: { name: queueName, user_uid: stateUid },
                        attributes: ['display_name', 'name'],
                    });
                    if (row) {
                        displayNameQ =
                            row.getDataValue('display_name')
                                || row.getDataValue('name')
                                || queueName;
                    }
                }
                catch { /* ignore */ }
                this.stateService.setQueue(stateUid, queueName, {
                    displayName: displayNameQ,
                    userUid: stateUid,
                });
            }
            this.stateService.recomputeQueueAgentStats(stateUid, queueName);
        }
        // Refresh SSE clients that connected under JWT tenant before shift login
        this.stateService.emitEvent('fullSnapshot', stateUid, this.stateService.getSnapshot(stateUid));
        // Log event
        await this.ccAmiService.logAgentEvent({
            sessionId: session.uid,
            userId,
            eventType: 'LOGIN',
            userUid: stateUid,
        });
        this.logger.log(`Agent ${displayName} (${agentInterface}) logged in, queues: [${queues.join(', ')}], stateTenant=${stateUid}`);
        return { success: true, sessionId: session.uid };
    }
    async agentLogout(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent state not found');
        const sessionKey = this.sessionKey(userUid, userId);
        const sessionId = this.activeSessions.get(sessionKey)
            ?? (await this.sessionModel.findOne({
                where: { user_id: userId, logout_time: null },
                order: [['login_time', 'DESC']],
            }))?.uid;
        return this.endShift({
            userUid,
            userId,
            agentInterface,
            sessionId: sessionId ?? null,
            reason: 'OPERATOR',
        });
    }
    async agentPause(userUid, userId, reason, queue) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent state not found');
        // Pause in specific queue or all queues
        const targetQueues = queue ? [queue] : agent.queues;
        for (const q of targetQueues) {
            try {
                await this.amiService.queuePause(q, agentInterface, true, reason);
            }
            catch (err) {
                this.logger.warn(`Failed to pause ${agentInterface} in ${q}: ${err.message}`);
            }
        }
        this.ccAmiService.clearNonQueueDialAttempt(userUid, agentInterface);
        this.stateService.setAgent(userUid, agentInterface, {
            status: 'PAUSED',
            pauseReason: reason || 'Pause',
            statusOrigin: 'manual',
            dialTarget: undefined,
            peerNumber: '',
        });
        const paused = this.stateService.getAgent(userUid, agentInterface);
        if (paused) {
            await this.ccAmiService.beginTimedStatus(paused, 'PAUSE', reason || 'Pause');
        }
        return { success: true };
    }
    async agentUnpause(userUid, userId, queue) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent state not found');
        const targetQueues = queue ? [queue] : agent.queues;
        for (const q of targetQueues) {
            try {
                await this.amiService.queuePause(q, agentInterface, false);
            }
            catch (err) {
                this.logger.warn(`Failed to unpause ${agentInterface} in ${q}: ${err.message}`);
            }
        }
        this.ccAmiService.clearNonQueueDialAttempt(userUid, agentInterface);
        this.stateService.setAgent(userUid, agentInterface, {
            status: 'READY',
            pauseReason: '',
            statusOrigin: 'manual',
            dialTarget: undefined,
            peerNumber: '',
        });
        const ready = this.stateService.getAgent(userUid, agentInterface);
        if (ready) {
            await this.ccAmiService.endTimedStatus(agent);
            await this.ccAmiService.logAgentEventForAgent(ready, 'READY');
        }
        return { success: true };
    }
    /**
     * Queue-paused outbound work: no inbound from queues, dial-out allowed,
     * counts as working time (not PAUSE journal).
     */
    async agentStartOutboundWork(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent state not found');
        const allowed = agent.status === 'READY'
            || agent.status === 'PAUSED'
            || agent.status === 'OUTBOUND_WORK';
        if (!allowed) {
            throw new common_1.BadRequestException('Outbound work is only available from READY or PAUSED');
        }
        const reason = 'outbound_work';
        // Set OUTBOUND_WORK before AMI queuePause so QueueMemberPause events do not
        // briefly remap the agent to PAUSED (which flashes "Change pause reason" in UI).
        await this.ccAmiService.endTimedStatus(agent);
        this.stateService.setAgent(userUid, agentInterface, {
            status: 'OUTBOUND_WORK',
            pauseReason: reason,
            statusOrigin: 'manual',
        });
        for (const q of agent.queues) {
            try {
                await this.amiService.queuePause(q, agentInterface, true, reason);
            }
            catch (err) {
                this.logger.warn(`Failed to pause ${agentInterface} in ${q} for outbound work: ${err.message}`);
            }
        }
        const live = this.stateService.getAgent(userUid, agentInterface);
        if (live) {
            await this.ccAmiService.logAgentEventForAgent(live, 'OUTBOUND_WORK', reason);
        }
        return { success: true };
    }
    /** Leave outbound work → READY (unpause queues). */
    async agentLeaveOutboundWork(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent state not found');
        if (agent.status !== 'OUTBOUND_WORK') {
            throw new common_1.BadRequestException('Agent is not in outbound work');
        }
        return this.agentUnpause(userUid, userId);
    }
    async agentHangup(userUid, userId, channel) {
        userUid = this.resolveTenant(userUid, userId);
        if (channel) {
            await this.amiService.hangup(channel);
            return { success: true };
        }
        // Find agent's current call and hangup
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface)
            || this.stateService.getAllAgentsGlobal().find((a) => a.interface === agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent not logged in');
        if (agent.currentCall) {
            const call = this.stateService.getCall(agent.currentCall);
            if (call) {
                const hangChannel = call.callerChannel || call.agentChannel || agentInterface;
                try {
                    await this.amiService.hangup(hangChannel);
                }
                catch (err) {
                    this.logger.warn(`Hangup failed for ${hangChannel}: ${err.message}`);
                }
            }
            return { success: true };
        }
        // Outbound / personal SIP (no queue currentCall) — hang live channel(s), then clear state.
        if (agent.status === 'IN_CALL'
            || agent.status === 'DIALING'
            || agent.status === 'RINGING'
            || agent.status === 'CONSULT'
            || agent.dialTarget
            || agent.peerNumber) {
            await this.hangupChannelsForInterface(agentInterface);
            this.ccAmiService.clearNonQueueDialAttempt(agent.userUid, agentInterface);
            this.stateService.setAgent(agent.userUid, agentInterface, {
                status: 'READY',
                dialTarget: undefined,
                peerNumber: '',
            });
            this.metricsService.recordAgentStatus(agent.userUid, agentInterface, 'READY');
            return { success: true };
        }
        throw new common_1.BadRequestException('No active call to hangup');
    }
    /** Hang every live CoreShowChannels row belonging to this PJSIP interface (+ twin). */
    async hangupChannelsForInterface(agentInterface) {
        if (!this.amiService.isConnected())
            return;
        try {
            const { events } = await this.amiService.getActiveChannels();
            const prefixes = this.agentChannelPrefixes(agentInterface);
            for (const evt of events) {
                const ch = String(evt.channel || '');
                if (!prefixes.some((p) => ch === p || ch.startsWith(`${p}-`)))
                    continue;
                try {
                    await this.amiService.hangup(ch);
                }
                catch (err) {
                    this.logger.warn(`Hangup channel ${ch} failed: ${err?.message || err}`);
                }
            }
        }
        catch (err) {
            this.logger.warn(`hangupChannelsForInterface failed: ${err?.message || err}`);
        }
    }
    agentChannelPrefixes(agentInterface) {
        const related = new Set([agentInterface]);
        const slash = agentInterface.indexOf('/');
        const tech = slash >= 0 ? agentInterface.slice(0, slash + 1) : '';
        const sipId = slash >= 0 ? agentInterface.slice(slash + 1) : agentInterface;
        const twin = (0, endpoint_ids_util_1.isWebrtcCompanion)(sipId) ? (0, endpoint_ids_util_1.primaryIdOf)(sipId) : (0, endpoint_ids_util_1.companionIdOf)(sipId);
        if (twin)
            related.add(`${tech}${twin}`);
        return [...related];
    }
    /**
     * Active shift for the current user (survives page refresh).
     * Rebinds in-memory agent.userId from an open DB session when needed.
     */
    async getAgentMe(jwtUserUid, userId) {
        const session = await this.sessionModel.findOne({
            where: { user_id: userId, logout_time: null },
            order: [['login_time', 'DESC']],
        });
        const tenant = this.stateService.findTenantForOnlineUser(userId)
            ?? (session ? Number(session.user_uid) : null)
            ?? jwtUserUid;
        let agent = this.stateService.getAllAgents(tenant).find((a) => a.userId === userId)
            || (session
                ? this.stateService.getAgent(Number(session.user_uid), session.agent_interface)
                    || this.stateService.getAgent(tenant, session.agent_interface)
                : undefined);
        if (session && agent) {
            this.activeSessions.set(this.sessionKey(Number(session.user_uid), userId), session.uid);
            // Re-attach login identity after AMI preload (userId was 0) and repair
            // display name when QueueMember echoed Originate CallerID (extension-only).
            const needsIdentity = !agent.userId || agent.userId !== userId;
            const needsName = this.isRawAgentDisplayName(agent.interface, agent.name);
            if (needsIdentity || needsName) {
                let displayName = agent.name;
                try {
                    const user = await this.userModel.findOne({ where: { uniqueid: userId } });
                    if (user) {
                        displayName =
                            user.getDataValue('name') || user.getDataValue('login') || displayName;
                    }
                }
                catch { /* ignore */ }
                this.stateService.setAgent(Number(session.user_uid), session.agent_interface, {
                    ...(needsIdentity ? { userId } : {}),
                    ...(needsName || needsIdentity ? { name: displayName } : {}),
                    loginTime: agent.loginTime || session.login_time,
                });
                agent = this.stateService.getAgent(Number(session.user_uid), session.agent_interface);
            }
            // Hydrate shift KPI from history so F5 / Nest restart match the journal.
            if (agent) {
                const loginTime = (agent.loginTime || session.login_time);
                if (loginTime) {
                    const rebuilt = await this.metricsService.rebuildSinceLoginFromHistory({
                        userUid: agent.userUid,
                        agentInterface: agent.interface,
                        operatorUserId: userId,
                        loginTime,
                    });
                    agent = this.stateService.setAgent(agent.userUid, agent.interface, {
                        callsTaken: rebuilt.answered,
                        callsMade: rebuilt.made,
                        callsMissed: rebuilt.missed,
                    });
                }
            }
        }
        if (!session) {
            return { active: false };
        }
        // Open session but no in-memory agent (Nest restart) — hydrate fully.
        if (!agent) {
            await this.shiftRestore.restoreSession(session);
            agent =
                this.stateService.getAgent(Number(session.user_uid), session.agent_interface)
                    || this.stateService.getAllAgents(Number(session.user_uid)).find((a) => a.userId === userId);
        }
        // Recover shift queues lost after Nest restart / AMI twin remap
        // (QueuesTab + CoworkersTab both key off agent.queues).
        if (agent && !(agent.queues?.length) && !agent.queuesDetached) {
            const recovered = this.recoverAgentQueues(agent.userUid, agent.interface);
            if (recovered.length) {
                agent = this.stateService.setAgent(agent.userUid, agent.interface, { queues: recovered });
            }
        }
        if (!agent) {
            return {
                active: true,
                interface: session.agent_interface,
                queues: session.getDataValue('queues_snapshot') || [],
                status: 'READY',
                name: session.agent_interface,
                sessionId: session.uid,
                loginTime: session.login_time,
                pauseReason: session.pause_reason || undefined,
                callsTaken: 0,
                callsMissed: 0,
                callsMade: 0,
                queuesDetached: false,
            };
        }
        return {
            active: true,
            interface: agent.interface,
            queues: agent.queues,
            status: agent.status,
            name: agent.name,
            sessionId: session.uid,
            loginTime: agent.loginTime || session.login_time,
            pauseReason: agent.pauseReason,
            callsTaken: agent.callsTaken,
            callsMissed: agent.callsMissed ?? 0,
            callsMade: agent.callsMade ?? 0,
            statusSince: agent.statusSince,
            queuesDetached: Boolean(agent.queuesDetached),
        };
    }
    /** Prefer queues on this interface, else any primary↔WebRTC twin in the same tenant. */
    recoverAgentQueues(userUid, agentInterface) {
        const self = this.stateService.getAgent(userUid, agentInterface);
        if (self?.queues?.length)
            return [...self.queues];
        for (const iface of CallCenterService_1.relatedQueueInterfaces(agentInterface)) {
            if (iface === agentInterface)
                continue;
            const twin = this.stateService.getAgent(userUid, iface);
            if (twin?.queues?.length)
                return [...twin.queues];
        }
        return [];
    }
    /**
     * Current agent's own dual shift/day answered·made·missed KPI (D-11/D-12).
     * Self-scoped only — the agent interface is resolved server-side from the
     * caller's own online presence, never accepted as a client-supplied param,
     * so an operator can never read a coworker's personal counters this way.
     */
    async getAgentKpi(userUid, userId) {
        const agent = this.stateService.getAllAgents(userUid).find((a) => a.userId === userId);
        if (agent?.loginTime && agent.userId) {
            await this.metricsService.rebuildSinceLoginFromHistory({
                userUid: agent.userUid,
                agentInterface: agent.interface,
                operatorUserId: agent.userId,
                loginTime: agent.loginTime instanceof Date ? agent.loginTime : new Date(agent.loginTime),
            });
        }
        else if (agent) {
            const session = await this.sessionModel.findOne({
                where: { user_id: userId, logout_time: null },
                order: [['login_time', 'DESC']],
            });
            const loginTime = session?.getDataValue('login_time');
            if (loginTime) {
                await this.metricsService.rebuildSinceLoginFromHistory({
                    userUid: agent.userUid,
                    agentInterface: agent.interface,
                    operatorUserId: userId,
                    loginTime,
                });
            }
        }
        return this.metricsService.getAgentKpi(userUid, agent?.interface || '');
    }
    /**
     * Current agent's own dual shift/day answered·made·missed KPI per queue (D-31/D-32) —
     * Queues tab (09-08). Self-scoped identically to getAgentKpi: the agent interface and
     * its queue membership are resolved server-side, never accepted from the client.
     */
    getAgentQueuesKpi(userUid, userId) {
        const agent = this.stateService.getAllAgents(userUid).find((a) => a.userId === userId);
        return this.metricsService.getAgentQueuesKpi(userUid, agent?.interface || '', agent?.queues || []);
    }
    /**
     * Hold — Put the caller on hold (they hear MusicOnHold).
     *
     * Two scenarios:
     * 1. SIP phone initiated — the phone sends SIP re-INVITE (sendonly),
     *    Asterisk fires AMI "Hold" event automatically, our AMI listener
     *    picks it up and updates state. Web button just reflects the status.
     *
     * 2. Web UI initiated — we use AMI "Redirect" to move the caller's
     *    channel into a parking/MOH context. The caller hears music.
     *    The agent channel stays in the bridge (or gets MOH as well).
     *
     * For approach #2, we use AMI Park action which is the cleanest way
     * to hold a call via AMI — it parks the caller and agent can retrieve.
     * Alternative: Redirect to a custom context with MusicOnHold().
     */
    async agentHold(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent?.currentCall)
            throw new common_1.BadRequestException('No active call');
        const call = this.stateService.getCall(agent.currentCall);
        if (!call)
            throw new common_1.BadRequestException('Call state not found');
        // If we have the caller channel, redirect it to MOH context
        if (call.callerChannel) {
            try {
                // Redirect the caller channel to a context with MusicOnHold()
                // This requires a context like [cc-hold] with exten => s,1,MusicOnHold(default)
                // Alternatively, use the built-in Asterisk Park action
                await this.amiService.action({
                    action: 'Redirect',
                    channel: call.callerChannel,
                    context: 'cc-hold',
                    exten: 's',
                    priority: '1',
                });
                this.logger.log(`Hold: redirected caller ${call.callerChannel} to MOH`);
            }
            catch (err) {
                this.logger.warn(`Hold AMI redirect failed: ${err.message}, updating state only`);
            }
        }
        // Update state (will also be updated by AMI Hold event if SIP-phone hold)
        this.stateService.setCall(agent.currentCall, { status: 'HOLD' });
        this.stateService.emitEvent('callHold', userUid, {
            uniqueid: agent.currentCall,
            agent: agentInterface,
        });
        // Log event
        const sessionId = this.activeSessions.get(this.sessionKey(userUid, userId));
        if (sessionId) {
            await this.ccAmiService.logAgentEvent({
                sessionId,
                userId,
                eventType: 'HOLD',
                callUniqueid: agent.currentCall,
                userUid,
            });
        }
        return { success: true };
    }
    /**
     * Unhold — Retrieve the caller from hold.
     *
     * If hold was done via Redirect (web UI), we redirect the caller back
     * to the agent's bridge. If hold was SIP-phone initiated, the phone
     * sends re-INVITE to resume and Asterisk fires AMI "Unhold".
     */
    async agentUnhold(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent?.currentCall)
            throw new common_1.BadRequestException('No active call');
        const call = this.stateService.getCall(agent.currentCall);
        if (!call)
            throw new common_1.BadRequestException('Call state not found');
        // If we have the caller channel, redirect back to agent bridge
        if (call.callerChannel && call.agentChannel) {
            try {
                const { exten: agentExten, context } = await this.resolveAgentRedirectTarget(userUid, agentInterface);
                await this.amiService.action({
                    action: 'Redirect',
                    channel: call.callerChannel,
                    context,
                    exten: agentExten,
                    priority: '1',
                });
                this.logger.log(`Unhold: redirected caller ${call.callerChannel} back to ${context},${agentExten}`);
            }
            catch (err) {
                this.logger.warn(`Unhold AMI redirect failed: ${err.message}, updating state only`);
            }
        }
        // Update state
        this.stateService.setCall(agent.currentCall, { status: 'TALKING' });
        this.stateService.emitEvent('callUnhold', userUid, {
            uniqueid: agent.currentCall,
            agent: agentInterface,
        });
        // Log event
        const sessionId = this.activeSessions.get(this.sessionKey(userUid, userId));
        if (sessionId) {
            await this.ccAmiService.logAgentEvent({
                sessionId,
                userId,
                eventType: 'UNHOLD',
                callUniqueid: agent.currentCall,
                userUid,
            });
        }
        return { success: true };
    }
    async agentTransfer(dto, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        if (!this.amiService.isConnected()) {
            throw new common_1.BadRequestException('AMI not connected');
        }
        if (!this.isTransferTargetAllowed(userUid, dto.target)) {
            throw new common_1.ForbiddenException('Transfer target not allowed');
        }
        // For blind transfer, use AMI Redirect
        if (dto.type === 'blind') {
            const call = this.stateService.getCall(dto.uniqueid);
            if (!call)
                throw new common_1.NotFoundException('Call not found');
            if (!call.callerChannel) {
                throw new common_1.BadRequestException('Caller channel not available');
            }
            const agentInterface = await this.resolveAgentInterface(userUid, userId);
            const contextOwner = call.agent || agentInterface;
            if (!contextOwner) {
                throw new common_1.BadRequestException('Agent interface not available for transfer context');
            }
            const { context } = await this.resolveAgentRedirectTarget(userUid, contextOwner);
            // Redirect the caller's Asterisk channel (not CallerID) to the target extension
            try {
                await this.amiService.action({
                    action: 'Redirect',
                    channel: call.callerChannel,
                    context,
                    exten: dto.target,
                    priority: '1',
                });
            }
            catch (err) {
                throw new common_1.BadRequestException(`Transfer failed: ${err.message}`);
            }
        }
        this.stateService.setCall(dto.uniqueid, { status: 'TRANSFERRED' });
        try {
            await this.queueCallModel.update({
                disposition: 'transferred',
                transfer_destination: dto.target,
            }, { where: { call_uniqueid: dto.uniqueid, user_uid: userUid } });
        }
        catch (err) {
            this.logger.warn(`Failed to persist transfer destination for ${dto.uniqueid}: ${err.message}`);
        }
        // Attended transfer would be handled by the SIP phone
        return { success: true };
    }
    async agentWrapupDone(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent state not found');
        // Cancel auto-timeout timer if pending
        this.ccAmiService.cancelWrapupTimer(userUid, agentInterface);
        await this.ccAmiService.endTimedStatus(agent);
        this.stateService.setAgent(userUid, agentInterface, {
            status: 'READY',
            currentCall: undefined,
        });
        this.stateService.emitEvent('wrapupEnd', userUid, { agent: agentInterface, reason: 'manual' });
        const ready = this.stateService.getAgent(userUid, agentInterface);
        if (ready) {
            await this.ccAmiService.logAgentEventForAgent(ready, 'WRAPUP_END', 'manual');
        }
        return { success: true };
    }
    async agentWrapupExtend(userUid, userId, seconds) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const settings = await this.settingsService.getOperatorSettings(userUid, userId);
        const addSeconds = seconds ?? settings.wrapup_extend_step;
        this.ccAmiService.extendWrapupTimer(userUid, agentInterface, addSeconds);
        return { success: true };
    }
    // ─── Supervisor Actions ─────────────────────────────────
    async supervisorSpy(agentInterface, mode, userUid, supervisorId) {
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent || agent.status !== 'IN_CALL') {
            throw new common_1.BadRequestException('Agent is not on a call');
        }
        // ChanSpy via AMI Originate
        // mode: spy = 'q' (quiet), whisper = 'w', barge = 'B'
        const spyOptions = mode === 'spy' ? 'q' : mode === 'whisper' ? 'w' : 'B';
        // Get supervisor's SIP interface
        const supervisor = await this.userModel.findOne({ where: { uniqueid: supervisorId, vpbx_user_uid: userUid } });
        if (!supervisor)
            throw new common_1.NotFoundException('Supervisor not found');
        // Build the ChanSpy channel — supervisor's device rings and connects to spy
        const supervisorExten = supervisor.getDataValue('extension') || supervisor.getDataValue('login');
        const spyChannel = `PJSIP/${supervisorExten}`;
        try {
            const { context } = await this.resolveAgentRedirectTarget(userUid, spyChannel);
            await this.amiService.originate(spyChannel, `Spy on ${agent.name}`, context, `ChanSpy(${agentInterface},${spyOptions})`);
        }
        catch (err) {
            throw new common_1.BadRequestException(`Spy failed: ${err.message}`);
        }
        this.logger.log(`Supervisor ${supervisorId} started ${mode} on ${agentInterface}`);
        return { success: true, mode };
    }
    // ─── Peer Actions (D-21…D-25) ───────────────────────────
    /**
     * Coworker↔coworker ChanSpy — the permission+scope+audit-gated peer analog of
     * supervisorSpy (which has no permission check beyond controller-level assertSupervisor).
     * Check order (RESEARCH Pitfall 2): target must be IN_CALL → shared online queue →
     * target spyable → requester can_spy → mode ∈ requester spy_modes → audit log → AMI originate.
     * A supervisor calling this endpoint is scoped by the same shared-queue check as any
     * other agent (D-25) — this endpoint never grants tenant-wide reach the way
     * supervisor/spy does; that broader supervisor tool is untouched by this method.
     */
    async peerSpy(requesterUserId, targetInterface, mode, userUid) {
        userUid = this.resolveTenant(userUid, requesterUserId);
        const requesterAgent = this.stateService
            .getAllAgents(userUid)
            .find(a => a.userId === requesterUserId);
        if (!requesterAgent)
            throw new common_1.NotFoundException('Requester agent not logged in');
        const targetAgent = this.stateService.getAgent(userUid, targetInterface);
        if (!targetAgent)
            throw new common_1.NotFoundException('Target agent not found');
        if (targetAgent.userUid !== userUid) {
            throw new common_1.BadRequestException('Agent belongs to another tenant');
        }
        if (targetAgent.status !== 'IN_CALL') {
            throw new common_1.BadRequestException('Agent is not on a call');
        }
        const sharedQueue = requesterAgent.queues.some(q => targetAgent.queues.includes(q));
        if (!sharedQueue) {
            throw new common_1.ForbiddenException('Not in a shared queue with the target agent');
        }
        const targetPerms = await this.permissionsService.getEffective(userUid, targetAgent.userId);
        if (!targetPerms.spyable) {
            throw new common_1.ForbiddenException('Target is not spyable');
        }
        const requesterPerms = await this.permissionsService.getEffective(userUid, requesterUserId);
        if (!requesterPerms.can_spy) {
            throw new common_1.ForbiddenException('can_spy not granted');
        }
        if (!requesterPerms.spy_modes.includes(mode)) {
            throw new common_1.ForbiddenException(`Mode ${mode} not granted`);
        }
        // D-24: audit row written before AMI originate — listen mode stays silent to the target,
        // but every spy invocation (any mode) must be attributable after the fact.
        await this.loggerService.logAction(requesterUserId, 'peer_spy', 'cc_agent', targetAgent.userId || null, userUid, `mode=${mode} target=${targetInterface}`);
        const spyOptions = mode === 'listen' ? 'q' : mode === 'whisper' ? 'w' : 'B';
        try {
            const { context } = await this.resolveAgentRedirectTarget(userUid, requesterAgent.interface);
            await this.amiService.originate(requesterAgent.interface, `Peer spy on ${targetAgent.name}`, context, `ChanSpy(${targetInterface},${spyOptions})`);
        }
        catch (err) {
            throw new common_1.BadRequestException(`Spy failed: ${err.message}`);
        }
        this.logger.log(`Peer spy: ${requesterUserId} started ${mode} on ${targetInterface}`);
        return { success: true, mode };
    }
    async supervisorForcePause(agentInterface, reason, userUid) {
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent not found');
        const pauseReason = (reason ?? '').trim();
        for (const q of agent.queues) {
            try {
                await this.amiService.queuePause(q, agentInterface, true, pauseReason || undefined);
            }
            catch { /* ignore */ }
        }
        this.stateService.setAgent(userUid, agentInterface, {
            status: 'PAUSED',
            pauseReason,
            statusOrigin: 'manual',
        });
        const paused = this.stateService.getAgent(userUid, agentInterface);
        if (paused) {
            await this.ccAmiService.beginTimedStatus(paused, 'PAUSE', pauseReason);
        }
        return { success: true };
    }
    async supervisorForceUnpause(agentInterface, userUid) {
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent not found');
        for (const q of agent.queues) {
            try {
                await this.amiService.queuePause(q, agentInterface, false);
            }
            catch { /* ignore */ }
        }
        await this.ccAmiService.endTimedStatus(agent);
        this.stateService.setAgent(userUid, agentInterface, {
            status: 'READY',
            pauseReason: '',
            statusOrigin: 'manual',
        });
        const ready = this.stateService.getAgent(userUid, agentInterface);
        if (ready) {
            await this.ccAmiService.logAgentEventForAgent(ready, 'READY');
        }
        return { success: true };
    }
    async supervisorQueueAdd(agentInterface, queue, penalty, userUid, supervisorUserId) {
        const scope = await this.accessListService.resolveScope(userUid, supervisorUserId);
        if (!this.accessListService.isQueueAllowed(scope, queue)) {
            throw new common_1.ForbiddenException('Queue is outside supervisor access list');
        }
        const agent = this.resolveLiveQueueAgent(userUid, agentInterface);
        const iface = agent?.interface && /^(PJSIP|SIP)\//i.test(agent.interface)
            ? agent.interface
            : agentInterface;
        if (!iface || /^user:/i.test(iface) || !/^(PJSIP|SIP)\//i.test(iface)) {
            throw new common_1.BadRequestException('A SIP interface is required to add to a queue');
        }
        try {
            await this.amiService.queueAdd(queue, iface, penalty);
        }
        catch (err) {
            if (!(0, ami_error_util_1.isAlreadyQueueMemberError)(err)) {
                throw new common_1.BadRequestException(`Failed to add to queue: ${(0, ami_error_util_1.amiFailureMessage)(err)}`);
            }
        }
        const live = agent
            || this.stateService.getAgent(userUid, iface)
            || this.stateService.getAllAgentsGlobal().find((a) => a.interface === iface);
        const targetUid = live?.userUid ?? userUid;
        const targetIface = live?.interface || iface;
        const previous = live?.queues ?? [];
        const queues = previous.includes(queue) ? previous : [...previous, queue];
        this.stateService.setAgent(targetUid, targetIface, {
            queues,
            queuesDetached: false,
        });
        if ((live?.userId ?? 0) > 0) {
            try {
                const session = await this.sessionModel.findOne({
                    where: { user_id: live.userId, logout_time: null },
                    order: [['login_time', 'DESC']],
                });
                if (session) {
                    const snap = session.getDataValue('queues_snapshot') || [];
                    const base = snap.length ? snap : previous;
                    const next = base.includes(queue) ? base : [...base, queue];
                    await session.update({ queues_snapshot: next });
                }
            }
            catch { /* ignore */ }
        }
        this.logger.log(`Supervisor added ${targetIface} to queue ${queue}`);
        const after = this.stateService.getAgent(targetUid, targetIface);
        return { success: true, queues: after?.queues ?? queues };
    }
    /** Refresh RAM membership from Asterisk QueueMember (source of truth). */
    async supervisorReconcileQueues(userUid, agentInterface) {
        await this.ccAmiService.resyncMembershipFromAsterisk();
        if (!agentInterface)
            return { success: true };
        const agent = this.resolveLiveQueueAgent(userUid, agentInterface);
        return {
            success: true,
            interface: agent?.interface || agentInterface,
            queues: agent?.queues ?? [],
        };
    }
    /** Live SIP/WebRTC agent for a supervisor queue action (twin or user: stub). */
    resolveLiveQueueAgent(userUid, agentInterface) {
        const direct = this.stateService.getAgent(userUid, agentInterface);
        if (direct && /^(PJSIP|SIP)\//i.test(direct.interface))
            return direct;
        const related = new Set(CallCenterService_1.relatedQueueInterfaces(agentInterface));
        const userMatch = agentInterface.match(/^user:(\d+)$/i);
        const userId = userMatch ? Number(userMatch[1]) : 0;
        return this.stateService.getAllAgentsGlobal().find((a) => {
            if (!a.interface || !/^(PJSIP|SIP)\//i.test(a.interface))
                return false;
            if (a.interface === agentInterface || related.has(a.interface))
                return true;
            return userId > 0 && a.userId === userId;
        }) ?? direct ?? null;
    }
    async supervisorStartShift(userUid, supervisorUserId, operatorUserId, agentInterface, queues) {
        const scope = await this.accessListService.resolveScope(userUid, supervisorUserId);
        if (!this.accessListService.isOperatorUserAllowed(scope, operatorUserId)) {
            throw new common_1.ForbiddenException('Operator is outside supervisor access list');
        }
        for (const queue of queues || []) {
            if (!this.accessListService.isQueueAllowed(scope, queue)) {
                throw new common_1.ForbiddenException(`Queue ${queue} is outside supervisor access list`);
            }
        }
        if (!queues?.length) {
            throw new common_1.BadRequestException('At least one queue is required');
        }
        if (!agentInterface || /^user:/i.test(agentInterface) || !/^(PJSIP|SIP)\//i.test(agentInterface)) {
            throw new common_1.BadRequestException('A SIP interface is required to start a shift');
        }
        return this.agentLogin(agentInterface, queues, userUid, operatorUserId);
    }
    async supervisorQueueRemove(agentInterface, queue, userUid) {
        const ifaces = CallCenterService_1.relatedQueueInterfaces(agentInterface);
        await this.purgeRealtimeQueueMember(queue, ifaces);
        let removedSomewhere = false;
        const errors = [];
        for (const iface of ifaces) {
            try {
                await this.amiService.queueRemove(queue, iface);
                removedSomewhere = true;
            }
            catch (err) {
                const msg = (0, ami_error_util_1.amiFailureMessage)(err);
                // Asterisk: member already gone (UI still had it / twin / Nest restart).
                if (/not there/i.test(msg) || /not a member/i.test(msg)) {
                    removedSomewhere = true;
                    continue;
                }
                errors.push(`${iface}: ${msg}`);
                this.logger.warn(`Supervisor queue-remove ${iface} from ${queue}: ${msg}`);
            }
        }
        if (!removedSomewhere && errors.length > 0) {
            throw new common_1.BadRequestException(`Failed to remove from queue: ${errors[0]}`);
        }
        const agent = this.stateService.getAgent(userUid, agentInterface)
            || this.stateService.getAllAgentsGlobal().find((a) => a.interface === agentInterface || ifaces.includes(a.interface));
        if (agent) {
            const queues = (agent.queues || []).filter((q) => q !== queue);
            this.stateService.setAgent(agent.userUid, agent.interface, { queues });
            if (agent.userId > 0) {
                try {
                    const session = await this.sessionModel.findOne({
                        where: { user_id: agent.userId, logout_time: null },
                        order: [['login_time', 'DESC']],
                    });
                    if (session) {
                        const snap = session.getDataValue('queues_snapshot') || [];
                        const next = (snap.length ? snap : agent.queues || []).filter((q) => q !== queue);
                        await session.update({ queues_snapshot: next.length ? next : [] });
                    }
                }
                catch { /* ignore */ }
            }
        }
        this.logger.log(`Supervisor removed ${agentInterface} from queue ${queue}`);
        const after = agent
            ? this.stateService.getAgent(agent.userUid, agent.interface)
            : null;
        return { success: true, queues: after?.queues ?? [] };
    }
    /**
     * Realtime queue members (Queues UI / queue_members_table) survive AMI QueueRemove.
     * Supervisor minus must delete the row or Asterisk puts the agent back.
     */
    async purgeRealtimeQueueMember(queue, ifaces) {
        const sequelize = this.queueModel?.sequelize;
        if (!sequelize || !queue || !ifaces.length)
            return;
        try {
            const [result] = await sequelize.query('DELETE FROM queue_members_table WHERE queue_name = :queue AND interface IN (:ifaces)', { replacements: { queue, ifaces } });
            const affected = Number(result?.affectedRows || 0);
            if (affected > 0) {
                this.logger.log(`Purged ${affected} realtime member(s) of ${queue}`);
            }
        }
        catch (err) {
            this.logger.warn(`Realtime queue-member purge failed for ${queue}: ${(0, ami_error_util_1.amiFailureMessage)(err)}`);
        }
    }
    async supervisorQueuePenalty(agentInterface, queue, penalty, userUid) {
        try {
            await this.amiService.action({
                action: 'QueuePenalty',
                Interface: agentInterface,
                Penalty: String(penalty),
                Queue: queue,
            });
        }
        catch (err) {
            throw new common_1.BadRequestException(`Queue penalty failed: ${err.message}`);
        }
        this.logger.log(`Supervisor set penalty ${penalty} for ${agentInterface} in ${queue}`);
        return { success: true };
    }
    async supervisorForceLogout(agentInterface, userUid) {
        const agent = this.stateService.getAgent(userUid, agentInterface);
        const session = await this.sessionModel.findOne({
            where: {
                logout_time: null,
                agent_interface: {
                    [sequelize_2.Op.in]: CallCenterService_1.relatedQueueInterfaces(agentInterface),
                },
                ...(agent?.userId ? { user_id: agent.userId } : {}),
            },
            order: [['login_time', 'DESC']],
        });
        const userId = agent?.userId || Number(session?.user_id);
        if (!userId)
            throw new common_1.NotFoundException('Agent not found');
        const tenant = agent?.userUid || Number(session?.user_uid) || userUid;
        return this.endShift({
            userUid: tenant,
            userId,
            agentInterface: agent?.interface || session?.agent_interface || agentInterface,
            sessionId: session?.uid ?? null,
            reason: 'SUPERVISOR',
        });
    }
    /** Re-add operator to queues from session snapshot after Asterisk restart. */
    async agentRejoinQueues(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const session = await this.sessionModel.findOne({
            where: { user_id: userId, logout_time: null },
            order: [['login_time', 'DESC']],
        });
        if (!session)
            throw new common_1.NotFoundException('No open shift');
        const snap = session.getDataValue('queues_snapshot') || [];
        const agent = this.stateService.getAgent(userUid, agentInterface);
        const queues = snap.length ? snap : (agent?.queues || []);
        if (!queues.length) {
            throw new common_1.BadRequestException('No queues to rejoin');
        }
        for (const queue of queues) {
            try {
                await this.amiService.queueAdd(queue, agentInterface);
            }
            catch (err) {
                this.logger.warn(`Rejoin failed ${agentInterface} → ${queue}: ${err.message}`);
            }
        }
        this.stateService.setAgent(userUid, agentInterface, {
            queues,
            queuesDetached: false,
        });
        await this.sessionModel.update({ queues_snapshot: queues }, { where: { uid: session.uid } });
        return { success: true, queues };
    }
    /** Mark operator panel as recently seen (SSE connect / activity). */
    async touchPanelSeen(userId) {
        if (!userId)
            return;
        try {
            await this.sessionModel.update({ panel_seen_at: new Date() }, { where: { user_id: userId, logout_time: null } });
        }
        catch { /* ignore */ }
    }
    bumpPanelConnection(userId, delta) {
        if (!userId)
            return 0;
        const next = Math.max(0, (this.panelConnections.get(userId) || 0) + delta);
        if (next === 0)
            this.panelConnections.delete(userId);
        else
            this.panelConnections.set(userId, next);
        return next;
    }
    getPanelConnectionCount(userId) {
        return this.panelConnections.get(userId) || 0;
    }
    async supervisorRedirectCall(uniqueid, target, userUid) {
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        if (!call.callerChannel) {
            throw new common_1.BadRequestException('Caller channel not available');
        }
        const exten = target.replace(/^PJSIP\//, '').replace(/^SIP\//, '');
        const contextOwner = call.agent || `PJSIP/${exten}`;
        const { context } = await this.resolveAgentRedirectTarget(userUid, contextOwner);
        try {
            await this.amiService.action({
                action: 'Redirect',
                channel: call.callerChannel,
                context,
                exten,
                priority: '1',
            });
        }
        catch (err) {
            throw new common_1.BadRequestException(`Redirect failed: ${err.message}`);
        }
        return { success: true, uniqueid, target: exten };
    }
    async supervisorHangupCall(uniqueid, userUid) {
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        const channel = call.callerChannel || call.agentChannel;
        if (!channel) {
            throw new common_1.BadRequestException('Caller channel not available');
        }
        try {
            await this.amiService.hangup(channel);
        }
        catch (err) {
            throw new common_1.BadRequestException(`Hangup failed: ${err.message}`);
        }
        return { success: true };
    }
    // ─── Call Control (D-27/D-28/D-29/D-33) ─────────────────
    //
    // Every method below opens with the same guard sequence: resolve the
    // requesting operator's own agentInterface → getCall → tenant guard →
    // own-call ownership guard (call.agent === agentInterface) → channel
    // presence guard — *before* touching AMI. No client-supplied userUid is
    // ever trusted; ids are always resolved server-side from the JWT.
    /**
     * Park the operator's own active call (D-28). Ownership-scoped like
     * agentHangup/resetZombieCall — an agent can only park their own call.
     * [ASSUMED] the exact AMI Park response field carrying the parking-space
     * extension is not verified against a live Asterisk instance in this repo
     * (09-RESEARCH.md confidence: MEDIUM) — surfaced best-effort for the UI.
     */
    async parkCall(uniqueid, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        if (call.agent !== agentInterface) {
            throw new common_1.ForbiddenException("Only the operator's own call can be parked");
        }
        if (!call.callerChannel) {
            throw new common_1.BadRequestException('Caller channel not available');
        }
        let res;
        try {
            res = await this.amiService.park(call.callerChannel);
        }
        catch (err) {
            throw new common_1.BadRequestException(`Park failed: ${err.message}`);
        }
        this.stateService.setCall(uniqueid, { status: 'HOLD' });
        this.logger.log(`Parked call ${uniqueid} (${call.callerChannel}) by ${agentInterface}`);
        const parkingSpace = res?.exten || res?.parkinglot || null;
        // Delta-driven refresh for every operator's ParkedCallsIndicator (D-45, 09-10).
        this.stateService.emitEvent('parkedCallsUpdate', userUid, { parkingSpace, action: 'parked' });
        return {
            success: true,
            uniqueid,
            // [ASSUMED] field name — verify on live Asterisk (09-VALIDATION).
            parkingSpace,
        };
    }
    /**
     * Retrieve a parked call into the requesting operator's own device (D-28).
     * Parked calls sit in a tenant-wide parking lot (not owned by a specific
     * agent), so beyond being a logged-in agent no further ownership check
     * applies — any operator in the tenant may retrieve any parked call.
     */
    async retrieveParkedCall(parkingSpace, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        if (!parkingSpace || !parkingSpace.trim()) {
            throw new common_1.BadRequestException('Parking space is required');
        }
        try {
            await this.amiService.originate(agentInterface, `Retrieve parked call ${parkingSpace}`, 'parkedcalls', parkingSpace);
        }
        catch (err) {
            throw new common_1.BadRequestException(`Retrieve failed: ${err.message}`);
        }
        this.logger.log(`Agent ${agentInterface} retrieving parked call ${parkingSpace}`);
        // Delta-driven refresh for every operator's ParkedCallsIndicator (D-45, 09-10).
        this.stateService.emitEvent('parkedCallsUpdate', userUid, { parkingSpace, action: 'retrieved' });
        return { success: true, parkingSpace };
    }
    /**
     * List the tenant's currently parked calls (D-28, 09-10 ParkedCallsIndicator).
     * Parking is a tenant-wide lot (see retrieveParkedCall) — only requires the
     * requester to be a logged-in agent, matching that method's ownership model.
     */
    async getParkedCalls(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        let events = [];
        try {
            const res = await this.amiService.parkedCalls();
            events = res?.events || [];
        }
        catch (err) {
            this.logger.warn(`getParkedCalls: AMI query failed: ${err.message}`);
            return [];
        }
        return events.map((evt) => ({
            // [ASSUMED] field names — verify on live Asterisk (09-VALIDATION), same
            // caveat as parkCall's response-field assumption above.
            parkingSpace: evt?.exten || evt?.parkinglot || '',
            callerIdNum: evt?.calleridnum || evt?.callerid || '',
            callerIdName: evt?.calleridname || '',
            channel: evt?.channel || undefined,
            timeoutSec: evt?.timeout != null ? Number(evt.timeout) : undefined,
        }));
    }
    /**
     * Add a third party to the operator's own active call via ConfBridge (D-28).
     * Both existing legs are moved into the same conference room in one atomic
     * Redirect (Channel + ExtraChannel keeps the bridge intact); the target is
     * brought in via Originate. Uses the same ad hoc dialplan-app-string
     * convention already used by supervisorSpy/peerSpy's ChanSpy-via-Originate
     * above (RESEARCH Alternatives Considered) rather than inventing a new AMI
     * mechanism. [ASSUMED — relies on existing dialplan evaluating this exten
     * as ConfBridge(); verify on live Asterisk, 09-VALIDATION.]
     */
    async addToConference(uniqueid, target, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        if (call.agent !== agentInterface) {
            throw new common_1.ForbiddenException("Only the operator's own call can be conferenced");
        }
        if (!call.callerChannel || !call.agentChannel) {
            throw new common_1.BadRequestException('Call channels not available yet');
        }
        if (!target || !target.trim()) {
            throw new common_1.BadRequestException('Conference target is required');
        }
        const { contextName } = await this.conferenceEphemeralService.ensureRoomForCall(uniqueid, userUid, userId);
        const exten = target.replace(/^PJSIP\//, '').replace(/^SIP\//, '');
        try {
            await this.amiService.action({
                action: 'Redirect',
                channel: call.callerChannel,
                context: contextName,
                exten: 's',
                priority: '1',
                extrachannel: call.agentChannel,
                extracontext: contextName,
                extraexten: 's',
                extrapriority: '1',
            });
            await this.amiService.originate(`PJSIP/${exten}`, `Conference ${contextName}`, contextName, 's');
        }
        catch (err) {
            throw new common_1.BadRequestException(`Conference failed: ${err.message}`);
        }
        this.stateService.setCall(uniqueid, { status: 'TALKING' });
        this.logger.log(`Conference ${contextName} started by ${agentInterface} with ${exten}`);
        return { success: true, room: contextName, target: exten };
    }
    /**
     * Operator self-serve reset of a "zombie" call — a channel stuck in the
     * panel with no BYE, per D-27. Strictly own-call only (never a coworker's,
     * unlike supervisorHangupCall) — this is the anti-griefing guard from the
     * threat model (T-09-07-01). Hangup is attempted best-effort; local state
     * is always cleared so the operator is never stuck behind a truly dead
     * channel even if the AMI Hangup itself fails.
     */
    async resetZombieCall(uniqueid, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        if (call.agent !== agentInterface) {
            throw new common_1.ForbiddenException("Only the operator's own call can be reset");
        }
        const channel = call.callerChannel || call.agentChannel;
        if (channel) {
            try {
                await this.amiService.hangup(channel);
            }
            catch (err) {
                this.logger.warn(`Zombie-reset hangup failed for ${channel}: ${err.message} — clearing state anyway`);
            }
        }
        this.stateService.removeCall(uniqueid, 'zombie-reset');
        this.stateService.setAgent(userUid, agentInterface, { status: 'READY', currentCall: undefined });
        await this.loggerService.logAction(userId, 'zombie_reset', 'cc_call', null, userUid, `uniqueid=${uniqueid} agent=${agentInterface}`);
        this.logger.log(`Zombie call ${uniqueid} reset by ${agentInterface}`);
        return { success: true, uniqueid };
    }
    /**
     * Warm transfer of the operator's own active call into a target queue (D-33).
     * Queue-only (not an arbitrary extension/agent — that's agentTransfer's
     * blind mode) and ownership-scoped, unlike agentTransfer which has no
     * per-call ownership check.
     */
    async warmTransferToQueue(uniqueid, queue, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        if (call.agent !== agentInterface) {
            throw new common_1.ForbiddenException("Only the operator's own call can be transferred");
        }
        if (!call.callerChannel) {
            throw new common_1.BadRequestException('Caller channel not available');
        }
        const queues = this.stateService.getAllQueues(userUid);
        if (!queues.some((q) => q.name === queue)) {
            throw new common_1.BadRequestException('Unknown target queue');
        }
        try {
            const { context } = await this.resolveAgentRedirectTarget(userUid, agentInterface);
            await this.amiService.action({
                action: 'Redirect',
                channel: call.callerChannel,
                context,
                exten: queue,
                priority: '1',
            });
        }
        catch (err) {
            throw new common_1.BadRequestException(`Warm transfer failed: ${err.message}`);
        }
        this.stateService.setCall(uniqueid, { status: 'TRANSFERRED', queue });
        try {
            await this.queueCallModel.update({
                disposition: 'transferred',
                transfer_destination: queue,
            }, { where: { call_uniqueid: uniqueid, user_uid: userUid } });
        }
        catch (err) {
            this.logger.warn(`Failed to persist warm-transfer destination for ${uniqueid}: ${err.message}`);
        }
        this.logger.log(`Warm transfer of ${uniqueid} to queue ${queue} by ${agentInterface}`);
        return { success: true, uniqueid, queue };
    }
    /**
     * Client-aware click-to-call (D-29 / D-33): WebRTC clients dial directly over
     * their own signalling (nothing to originate server-side); PJSIP clients
     * (softphone/hardware) get an operator-leg Originate with an auto-answer
     * Call-Info header, then dial the target — same scheme as the D-18
     * missed-call callback flow.
     *
     * Mode-aware gate (D-40 gap): WebRTC companion on shift skips click_to_call
     * assert (right N/A — client dials). SIP/PJSIP still requires click_to_call
     * so an admin can revoke panel originate. Never trust a client-sent flag.
     * [ASSUMED] exact SIPADDHEADER Call-Info syntax for auto-answer — verify
     * against the live PJSIP endpoint config (09-VALIDATION).
     */
    async clickToCall(target, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const sipId = agentInterface.replace(/^PJSIP\//, '').replace(/^SIP\//, '');
        if (!(0, endpoint_ids_util_1.isWebrtcCompanion)(sipId)) {
            await this.permissionsService.assert(userUid, userId, 'click_to_call');
        }
        return this.originateDial(agentInterface, target, userUid, userId);
    }
    /**
     * Shared WebRTC-direct / PJSIP-originate-with-auto-answer dial, used by
     * both clickToCall (D-29) and callbackMissedCall (D-18) — same scheme,
     * never duplicated (09-09 Task 2).
     *
     * PJSIP Originate must use the endpoint's real dialplan context
     * (tenant-suffixed `from-internal0` / `sip-out7`, …) — bare `from-internal`
     * does not exist on multi-tenant dialplans and AMI rejects with
     * "Extension does not exist" before any channel appears on the CLI.
     *
     * Auto-answer of the operator leg uses SIP Call-Info answer-after=0 when
     * operator setting `auto_answer` is enabled (same toggle as WebRTC auto-answer).
     */
    async originateDial(agentInterface, target, userUid, operatorUserId) {
        const dialTarget = (target || '').replace(/[^\d+*#]/g, '');
        if (!dialTarget) {
            throw new common_1.BadRequestException('Target is required');
        }
        const sipId = agentInterface.replace(/^PJSIP\//, '').replace(/^SIP\//, '');
        if ((0, endpoint_ids_util_1.isWebrtcCompanion)(sipId)) {
            // WebRTC dials directly through its own client signalling — no AMI action here.
            this.logger.log(`Click-to-call (webrtc) ${agentInterface} -> ${dialTarget}`);
            return { success: true, mode: 'webrtc', target: dialTarget };
        }
        const { context } = await this.resolveAgentRedirectTarget(userUid, agentInterface);
        let autoAnswer = false;
        if (operatorUserId != null) {
            try {
                const settings = await this.settingsService.getOperatorSettings(userUid, operatorUserId);
                autoAnswer = Boolean(settings?.auto_answer);
            }
            catch {
                autoAnswer = false;
            }
        }
        const live = this.stateService.getAgent(userUid, agentInterface)
            || this.stateService.getAllAgentsGlobal().find((a) => a.interface === agentInterface);
        const stateUid = live?.userUid ?? userUid;
        // Destination INVITE inherits Originate CallerID after the operator answers.
        // Operator ring: show "click-to-call" + target number on the SIP client.
        // After answer, [krsk-click-to-call] clears the name and restores op CID num
        // so the callee never sees the UI label.
        const opExt = (0, endpoint_ids_util_1.interfaceToExtension)(agentInterface) || (0, endpoint_ids_util_1.extractExtension)(sipId) || '';
        const callerid = `"click-to-call" <${dialTarget}>`;
        const channelVars = [
            `KRSK_CTC_CONTEXT=${context}`,
            ...(opExt ? [`KRSK_CTC_OP_NUM=${opExt}`] : []),
        ];
        // Yealink / many PJSIP phones: Call-Info answer-after=0 forces auto-answer of the
        // operator leg so click-to-call does not require a manual pickup.
        if (autoAnswer) {
            channelVars.push('SIPADDHEADER=Call-Info: sip:\\;answer-after=0');
        }
        const originateParams = {
            action: 'Originate',
            channel: agentInterface,
            context: 'krsk-click-to-call',
            exten: dialTarget,
            priority: '1',
            callerid,
            async: 'true',
            variable: channelVars.join(','),
        };
        try {
            await this.amiService.action(originateParams);
        }
        catch (err) {
            throw new common_1.BadRequestException(`Click-to-call failed: ${err.message}`);
        }
        this.stateService.setAgent(stateUid, agentInterface, {
            status: 'DIALING',
            dialTarget,
        });
        this.metricsService.recordAgentStatus(stateUid, agentInterface, 'DIALING');
        this.logger.log(`Click-to-call (pjsip) ${agentInterface} -> ${context},${dialTarget}`
            + (autoAnswer ? ' (auto-answer)' : ''));
        return { success: true, mode: 'pjsip', target: dialTarget };
    }
    /**
     * D-18/D-29: operator-initiated callback for a missed-call number, reusing
     * clickToCall's WebRTC-direct/PJSIP-originate branching. Gated only by an
     * active shift (logged-in agent) — missed-call worklist callback is core
     * operator work and must not require the separate click_to_call right.
     */
    async callbackMissedCall(userUid, operatorUserId, callerIdNum) {
        userUid = this.resolveTenant(userUid, operatorUserId);
        const agentInterface = await this.resolveAgentInterface(userUid, operatorUserId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        if (!callerIdNum)
            throw new common_1.BadRequestException('callerIdNum is required');
        const result = await this.originateDial(agentInterface, callerIdNum, userUid, operatorUserId);
        this.trackCallbackOutcome(userUid, agentInterface, callerIdNum, operatorUserId);
        return result;
    }
    /**
     * Watches the operator's AgentState for the IN_CALL -> not-IN_CALL
     * transition following a callback dial and measures its duration
     * (D-18's >5s rule). Fire-and-forget — never blocks the REST response.
     * Gives up after 2 minutes if the call never appears to connect/end.
     */
    trackCallbackOutcome(userUid, agentInterface, callerIdNum, operatorUserId) {
        let answeredAt;
        let settled = false;
        const finish = (connected) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            sub.unsubscribe();
            const durationSec = answeredAt !== undefined ? (Date.now() - answeredAt) / 1000 : 0;
            void this.resolveCallbackOutcome(userUid, operatorUserId, callerIdNum, connected && durationSec > 5);
        };
        const timer = setTimeout(() => finish(false), 120_000);
        const sub = this.stateService.getEventStream(userUid).subscribe((evt) => {
            if (evt.type !== 'agentUpdate' || evt.data?.interface !== agentInterface)
                return;
            if (evt.data.status === 'IN_CALL' && answeredAt === undefined) {
                answeredAt = Date.now();
                return;
            }
            if (answeredAt !== undefined && evt.data.status !== 'IN_CALL') {
                finish(true);
            }
        });
    }
    async resolveCallbackOutcome(userUid, operatorUserId, callerIdNum, success) {
        try {
            if (success) {
                await this.missedCallModel.update({ called_back: true, called_back_by: operatorUserId, called_back_at: new Date() }, {
                    where: {
                        user_uid: userUid,
                        caller_id_num: callerIdNum,
                        called_back: false,
                        client_called_back: false,
                    },
                });
                this.stateService.emitEvent('missedCallUpdate', userUid, {
                    callerIdNum,
                    called_back: true,
                    called_back_by: operatorUserId,
                });
            }
            else {
                await this.missedCallModel.create({
                    call_uniqueid: `callback-${userUid}-${callerIdNum}-${Date.now()}`,
                    queue_name: 'callback-attempt',
                    caller_id_num: callerIdNum,
                    caller_id_name: '',
                    hold_time: 0,
                    position: 0,
                    called_back: false,
                    client_called_back: false,
                    personal: false,
                    user_uid: userUid,
                });
                this.stateService.emitEvent('missedCallUpdate', userUid, { callerIdNum, attempt: true });
            }
        }
        catch (err) {
            this.logger.warn(`Failed to resolve callback outcome: ${err.message}`);
        }
    }
    /**
     * Agent detail for supervisor modal: today's stats + timeline segments (D-36 contract).
     * Segments are built server-side from cc_agent_events; presentation is AgentTimeline (07-09).
     */
    async getAgentDetail(agentInterface, userUid) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const queueCalls = await this.queueCallModel.findAll({
            where: {
                user_uid: userUid,
                agent_interface: agentInterface,
                created_at: { [sequelize_2.Op.gte]: startOfDay },
            },
        });
        const answeredCalls = queueCalls.filter(c => c.disposition === 'answered');
        const callsHandled = answeredCalls.length;
        const totalTalk = queueCalls.reduce((s, c) => s + (c.talk_time || 0), 0);
        const totalHold = queueCalls.reduce((s, c) => s + (c.hold_time || 0), 0);
        const aht = Math.round(totalTalk / Math.max(callsHandled, 1));
        const asa = callsHandled > 0
            ? Math.round(answeredCalls.reduce((s, c) => s + (c.wait_time || 0), 0) / callsHandled)
            : 0;
        const liveAgent = this.stateService.getAgent(userUid, agentInterface);
        const kpi = this.metricsService.getAgentKpi(userUid, agentInterface);
        const occupancy = this.metricsService.getAgentOccupancy(userUid, agentInterface);
        const todaySessions = await this.sessionModel.findAll({
            where: {
                user_uid: userUid,
                agent_interface: agentInterface,
                login_time: { [sequelize_2.Op.gte]: startOfDay },
            },
            attributes: ['uid'],
        });
        const sessionIds = todaySessions.map(s => s.uid);
        let events = [];
        if (sessionIds.length > 0) {
            events = await this.agentEventModel.findAll({
                where: {
                    user_uid: userUid,
                    session_id: { [sequelize_2.Op.in]: sessionIds },
                    created_at: { [sequelize_2.Op.gte]: startOfDay },
                },
                order: [['created_at', 'ASC']],
            });
        }
        const segments = this.buildAgentTimelineSegments(events);
        const pauseTotalSec = segments
            .filter(s => s.state === 'PAUSED')
            .reduce((s, seg) => s + (seg.durationSec || 0), 0);
        const wrapupTotalSec = segments
            .filter(s => s.state === 'WRAPUP' || s.state === 'ACW')
            .reduce((s, seg) => s + (seg.durationSec || 0), 0);
        const loginDurationSec = liveAgent?.loginTime
            ? Math.max(0, Math.round((Date.now() - liveAgent.loginTime.getTime()) / 1000))
            : 0;
        return {
            stats: {
                status: liveAgent?.status || 'OFFLINE',
                pauseReason: liveAgent?.pauseReason,
                callsHandled,
                callsTaken: liveAgent?.callsTaken ?? kpi.sinceLogin.answered,
                callsMade: liveAgent?.callsMade ?? kpi.sinceLogin.made,
                callsMissed: liveAgent?.callsMissed ?? kpi.sinceLogin.missed,
                shiftAnswered: kpi.sinceLogin.answered,
                shiftMade: kpi.sinceLogin.made,
                shiftMissed: kpi.sinceLogin.missed,
                dayAnswered: kpi.sinceMidnight.answered,
                dayMade: kpi.sinceMidnight.made,
                dayMissed: kpi.sinceMidnight.missed,
                totalTalk,
                aht,
                asa,
                totalHold,
                occupancy,
                loginDurationSec,
                pauseTotalSec,
                wrapupTotalSec,
                queuesDetached: Boolean(liveAgent?.queuesDetached),
                queues: liveAgent?.queues ?? [],
            },
            segments,
        };
    }
    /**
     * Maps cc_agent_events to contiguous timeline segments (shared contract with reports getAgentTimeline).
     */
    buildAgentTimelineSegments(events) {
        if (events.length === 0)
            return [];
        const now = new Date();
        const segments = [];
        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            const start = ev.created_at || now;
            const end = i + 1 < events.length ? (events[i + 1].created_at || now) : now;
            const durationSec = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
            segments.push({
                state: this.eventTypeToTimelineState(ev.event_type),
                startTs: start.toISOString(),
                endTs: end.toISOString(),
                durationSec,
                reason: ev.reason || undefined,
            });
        }
        return segments;
    }
    /** event_type → AgentTimeline segment.state (status palette) */
    eventTypeToTimelineState(eventType) {
        switch (eventType) {
            case 'LOGIN':
            case 'READY':
            case 'CALL_END':
            case 'WRAPUP_END':
                return 'READY';
            case 'PAUSE':
                return 'PAUSED';
            case 'CALL_START':
            case 'UNHOLD':
                return 'IN_CALL';
            case 'HOLD':
                return 'HOLD';
            case 'WRAPUP_START':
                return 'WRAPUP';
            /** Phase 9 (D-09/D-13): dialing/consultation/after-call-work segments. */
            case 'DIALING':
                return 'DIALING';
            case 'CONSULT':
                return 'CONSULT';
            case 'ACW':
                return 'ACW';
            case 'LOGOUT':
                return 'OFFLINE';
            default:
                return 'OFFLINE';
        }
    }
    // ─── Pause Reasons CRUD ─────────────────────────────────
    async getPauseReasons(userUid) {
        return this.pauseReasonModel.findAll({
            where: { user_uid: userUid },
            order: [['sort_order', 'ASC'], ['name', 'ASC']],
        });
    }
    async createPauseReason(dto, userUid) {
        return this.pauseReasonModel.create({ ...dto, user_uid: userUid });
    }
    async updatePauseReason(id, dto, userUid) {
        const reason = await this.pauseReasonModel.findOne({ where: { uid: id, user_uid: userUid } });
        if (!reason)
            throw new common_1.NotFoundException('Pause reason not found');
        return reason.update(dto);
    }
    async deletePauseReason(id, userUid) {
        const reason = await this.pauseReasonModel.findOne({ where: { uid: id, user_uid: userUid } });
        if (!reason)
            throw new common_1.NotFoundException('Pause reason not found');
        await reason.destroy();
        return { success: true };
    }
    // ─── Softphone contact book (D-11…D-15) ─────────────────
    /** Tenant-scoped shared book for Contacts "Книга" — never trust client tenant ids. */
    async getMyContacts(userUid) {
        return this.contactModel.findAll({
            where: { user_uid: userUid },
            order: [['name', 'ASC']],
        });
    }
    async createContact(dto, userUid, userId) {
        return this.contactModel.create({
            name: dto.name,
            number: dto.number,
            note: dto.note ?? null,
            user_uid: userUid,
            created_by: userId,
        });
    }
    /**
     * D-13: ownership folded into where (operator = own rows only; supervisor any tenant row).
     * Never a post-fetch ownership if — NotFound when absent from filtered where.
     */
    async updateContact(id, dto, userUid, userId, isSupervisor) {
        const where = { uid: id, user_uid: userUid };
        if (!isSupervisor)
            where.created_by = userId;
        const row = await this.contactModel.findOne({ where });
        if (!row)
            throw new common_1.NotFoundException('Contact not found');
        // Never trust client user_uid / created_by — only whitelist fields from DTO.
        const patch = {};
        if (dto.name !== undefined)
            patch.name = dto.name;
        if (dto.number !== undefined)
            patch.number = dto.number;
        if (dto.note !== undefined)
            patch.note = dto.note;
        return row.update(patch);
    }
    async deleteContact(id, userUid, userId, isSupervisor) {
        const where = { uid: id, user_uid: userUid };
        if (!isSupervisor)
            where.created_by = userId;
        const row = await this.contactModel.findOne({ where });
        if (!row)
            throw new common_1.NotFoundException('Contact not found');
        await row.destroy();
        return { success: true };
    }
    /**
     * SIP-mode in-call DTMF via AMI PlayDTMF (D-32).
     * Channel is resolved from the caller's own active call — never client-supplied.
     * Digit must already be a single [0-9*#A-D] (DTO + defense-in-depth here).
     */
    async sendDtmf(userUid, userId, uniqueid, digit) {
        if (!/^[0-9*#A-D]$/.test(digit)) {
            throw new common_1.BadRequestException('Invalid DTMF digit');
        }
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        if (call.agent !== agentInterface) {
            throw new common_1.ForbiddenException("Only the operator's own call can receive DTMF");
        }
        const channel = call.agentChannel || call.callerChannel;
        if (!channel) {
            throw new common_1.BadRequestException('Call channel not available');
        }
        try {
            await this.amiService.playDtmf(channel, digit);
        }
        catch (err) {
            this.logger.warn(`PlayDTMF failed for ${channel} digit=${digit}: ${err?.message}`);
            throw new common_1.BadRequestException(`DTMF failed: ${err?.message}`);
        }
        return { success: true, uniqueid, digit };
    }
    /**
     * Operator's own endpoint online/offline for SIP softphone trigger (D-35).
     * Extension/mode re-derived server-side — never trust client-supplied mode.
     *
     * Source of truth order:
     * 1. Live PJSIPShowEndpoint contact status (same as `pjsip show contacts` Avail)
     * 2. Presence cache from DeviceStateChange
     * 3. Live DeviceStateList seed when cache is empty
     *
     * DeviceState alone often stays UNAVAILABLE / never seeded without BLF hints,
     * while the handset contact is Reachable — Recover must not stick on false.
     */
    async getMyRegistrationState(userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface) {
            return { online: false };
        }
        const sipId = agentInterface.includes('/')
            ? agentInterface.slice(agentInterface.indexOf('/') + 1)
            : agentInterface;
        // WebRTC companion → look up primary SIP handset registration; else self.
        const endpointId = (0, endpoint_ids_util_1.isWebrtcCompanion)(sipId) ? ((0, endpoint_ids_util_1.primaryIdOf)(sipId) ?? sipId) : sipId;
        const extension = (0, endpoint_ids_util_1.extractExtension)(endpointId);
        try {
            const reachable = await this.amiService.isPjsipEndpointReachable(endpointId);
            if (reachable !== null) {
                this.presenceService.handleDeviceStateChange({
                    device: `PJSIP/${endpointId}`,
                    state: reachable ? 'NOT_INUSE' : 'UNAVAILABLE',
                });
                return { online: reachable };
            }
        }
        catch (err) {
            this.logger.warn(`getMyRegistrationState PJSIPShowEndpoint failed for ${endpointId}: ${err?.message || err}`);
        }
        let state = this.presenceService.getPresence(userUid, extension);
        if (!state || /^(unavailable|invalid|unknown)$/i.test(String(state).trim())) {
            try {
                const { events } = await this.amiService.collectDeviceStateList();
                for (const evt of events) {
                    this.presenceService.handleDeviceStateChange(evt);
                }
                state = this.presenceService.getPresence(userUid, extension);
            }
            catch (err) {
                this.logger.warn(`getMyRegistrationState DeviceStateList failed: ${err?.message || err}`);
            }
        }
        if (!state) {
            return { online: false };
        }
        // Offline DeviceState values; anything else (NOT_INUSE/INUSE/BUSY/RINGING/…) = online.
        const offline = /^(unavailable|invalid|unknown)$/i.test(String(state).trim());
        return { online: !offline };
    }
    /**
     * True when agent.name is a channel/extension placeholder, not a person name.
     * Mirrors CallCenterAmiService.isRawAgentName (Originate CID / QueueMember).
     */
    isRawAgentDisplayName(iface, name) {
        if (!name)
            return true;
        if (name === iface)
            return true;
        if (/^(PJSIP|SIP)\//i.test(name))
            return true;
        const ext = (0, endpoint_ids_util_1.interfaceToExtension)(iface);
        if (ext && name === ext)
            return true;
        if (/^e(w)?.+_\d+$/i.test(name))
            return true;
        return false;
    }
    /**
     * Resolve AMI Redirect target for an agent interface.
     * Uses the endpoint's real dialplan context (tenant-suffixed, e.g. from-internal0)
     * and the numeric extension (ew112_0 → 112) — never raw SIP id / bare from-internal.
     */
    async resolveAgentRedirectTarget(userUid, agentInterface) {
        const exten = (0, endpoint_ids_util_1.interfaceToExtension)(agentInterface);
        const sipId = agentInterface.includes('/')
            ? agentInterface.slice(agentInterface.indexOf('/') + 1)
            : agentInterface;
        const primaryId = (0, endpoint_ids_util_1.primaryIdOf)(sipId) ?? sipId;
        try {
            const ep = (await this.endpointModel.findByPk(primaryId))
                ?? (await this.endpointModel.findByPk(sipId));
            const ctx = ep?.getDataValue?.('context')
                ?? ep?.context;
            if (ctx && String(ctx).trim()) {
                return { exten, context: String(ctx).trim() };
            }
        }
        catch (err) {
            this.logger.warn(`resolveAgentRedirectTarget: endpoint lookup failed: ${err.message}`);
        }
        // Last resort: tenant-suffixed default (endpoints.service buildContext pattern)
        return { exten, context: `from-internal${userUid}` };
    }
    // ─── Pick Call ──────────────────────────────────────────
    //
    // Pick Call: agent manually grabs a waiting caller from a queue.
    // AMI Redirect of the caller channel to the agent's dialplan extension
    // (endpoint context + numeric exten), bypassing queue strategy.
    async agentPickCall(uniqueid, userUid, userId) {
        userUid = this.resolveTenant(userUid, userId);
        const agentInterface = await this.resolveAgentInterface(userUid, userId);
        if (!agentInterface)
            throw new common_1.NotFoundException('Agent not logged in');
        const agent = this.stateService.getAgent(userUid, agentInterface);
        if (!agent)
            throw new common_1.NotFoundException('Agent state not found');
        if (agent.status !== 'READY') {
            throw new common_1.BadRequestException(`Agent must be READY to pick a call (current: ${agent.status})`);
        }
        const settings = await this.settingsService.getOperatorSettings(userUid, userId);
        if (!settings.pickup_enabled) {
            throw new common_1.ForbiddenException('Pickup not allowed for this operator');
        }
        const call = this.stateService.getCall(uniqueid);
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        if (call.userUid !== userUid) {
            throw new common_1.BadRequestException('Call belongs to another tenant');
        }
        if (call.status !== 'WAITING' && call.status !== 'RINGING') {
            throw new common_1.BadRequestException(`Call is not pickable (status: ${call.status})`);
        }
        const callerChannel = call.callerChannel;
        if (!callerChannel) {
            throw new common_1.BadRequestException('Caller channel not available yet — try again in a moment');
        }
        const { exten: agentExten, context } = await this.resolveAgentRedirectTarget(userUid, agentInterface);
        try {
            await this.amiService.action({
                action: 'Redirect',
                channel: callerChannel,
                context,
                exten: agentExten,
                priority: '1',
            });
        }
        catch (err) {
            throw new common_1.BadRequestException(`Pick call failed: ${err.message}`);
        }
        this.logger.log(`Agent ${agentInterface} picked call ${uniqueid} from queue ${call.queue} → ${context},${agentExten}`);
        return { success: true, uniqueid, target: agentExten, context };
    }
    // ─── Missed Calls ──────────────────────────────────────
    async logMissedCall(params) {
        try {
            const [, created] = await this.missedCallModel.findOrCreate({
                where: { call_uniqueid: params.uniqueid },
                defaults: {
                    call_uniqueid: params.uniqueid,
                    queue_name: params.queueName,
                    caller_id_num: params.callerIdNum || '',
                    caller_id_name: params.callerIdName || '',
                    hold_time: params.holdTime || 0,
                    position: params.position || 0,
                    called_back: false,
                    user_uid: params.userUid,
                },
            });
            if (!created)
                return;
            this.stateService.emitEvent('missedCallNew', params.userUid, {
                uniqueid: params.uniqueid,
                queue: params.queueName,
                callerIdNum: params.callerIdNum,
                holdTime: params.holdTime || 0,
            });
        }
        catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError')
                return;
            this.logger.warn(`Failed to log missed call: ${err.message}`);
        }
    }
    async getMissedCalls(userUid, includeHandled = false, userId) {
        const tenant = userId != null
            ? (this.stateService.findTenantForOnlineUser(userId) ?? userUid)
            : userUid;
        const where = { user_uid: tenant };
        if (!includeHandled)
            where.called_back = false;
        const rows = await this.missedCallModel.findAll({
            where,
            order: [['created_at', 'DESC']],
            limit: 200,
        });
        // Defensive: collapse legacy duplicates that share the same Asterisk uniqueid
        const seen = new Set();
        const unique = rows.filter((r) => {
            const id = r.call_uniqueid;
            if (!id || seen.has(id))
                return false;
            seen.add(id);
            return true;
        });
        // Resolve operator display names for the resolved sub-view (called_back_by).
        const handlerIds = [
            ...new Set(unique
                .map((r) => r.called_back_by)
                .filter((id) => id != null && id > 0)),
        ];
        const nameById = new Map();
        if (handlerIds.length > 0) {
            const users = await this.userModel.findAll({
                where: { uniqueid: { [sequelize_2.Op.in]: handlerIds }, vpbx_user_uid: tenant },
                attributes: ['uniqueid', 'name', 'login'],
            });
            for (const u of users) {
                const id = u.getDataValue('uniqueid');
                const label = u.getDataValue('name')
                    || u.getDataValue('login')
                    || `#${id}`;
                nameById.set(id, label);
            }
        }
        return unique.map((r) => {
            const json = r.toJSON();
            const by = r.called_back_by;
            return {
                ...json,
                called_back_by_name: by != null && by > 0 ? (nameById.get(by) ?? `#${by}`) : null,
            };
        });
    }
    async markMissedCalled(id, note, userUid, userId) {
        const missed = await this.missedCallModel.findOne({
            where: { uid: id, user_uid: userUid },
        });
        if (!missed)
            throw new common_1.NotFoundException('Missed call not found');
        await missed.update({
            called_back: true,
            called_back_by: userId,
            called_back_at: new Date(),
            note: note || '',
        });
        this.stateService.emitEvent('missedCallUpdate', userUid, {
            id: missed.uid,
            called_back: true,
            called_back_by: userId,
        });
        return { success: true };
    }
    /**
     * Number-level worklist (D-16/D-19): groups the call-level cc_missed_calls
     * rows by caller_id_num + personal at the READ layer only — the table
     * itself stays call-level (findOrCreate-by-uniqueid in persistMissedCall
     * keeps UNIQUE(call_uniqueid) intact, RESEARCH Pitfall 4). Excludes rows
     * already resolved (called_back) or self-resolved (client_called_back).
     */
    async getMissedCallsGrouped(userUid) {
        const rows = await this.missedCallModel.findAll({
            where: { user_uid: userUid, called_back: false, client_called_back: false },
            attributes: [
                'caller_id_num',
                'personal',
                [(0, sequelize_2.fn)('COUNT', (0, sequelize_2.col)('uid')), 'attemptCount'],
                [(0, sequelize_2.fn)('MAX', (0, sequelize_2.col)('created_at')), 'lastAttemptAt'],
                [(0, sequelize_2.fn)('MAX', (0, sequelize_2.col)('called_back_by')), 'claimedBy'],
                [(0, sequelize_2.fn)('MAX', (0, sequelize_2.col)('caller_id_name')), 'callerIdName'],
                // D-19 queue-name chip for queue-missed rows — same MAX-aggregate
                // idiom as callerIdName/claimedBy above (09-10, Rule 2: the UI's
                // queue-missed chip has no data source without this).
                [(0, sequelize_2.fn)('MAX', (0, sequelize_2.col)('queue_name')), 'queueName'],
            ],
            group: ['caller_id_num', 'personal'],
            order: [[(0, sequelize_2.literal)('lastAttemptAt'), 'DESC']],
            raw: true,
        });
        return rows.map((r) => ({
            callerIdNum: r.caller_id_num,
            callerIdName: r.callerIdName || '',
            personal: !!r.personal,
            attemptCount: parseInt(r.attemptCount, 10) || 0,
            lastAttemptAt: r.lastAttemptAt,
            claimedBy: r.claimedBy ?? null,
            queueName: r.queueName || null,
        }));
    }
    /**
     * Claims a queue-missed (shared-pool) number group for the operator
     * (D-19). Personal misses are already owned by the agent whose channel
     * rang, so claim only ever targets personal=false rows. Idempotent —
     * server is source of truth on conflict, last write wins (T-09-09-03).
     */
    async claimMissedCall(userUid, operatorUserId, callerIdNum) {
        if (!callerIdNum)
            throw new common_1.BadRequestException('callerIdNum is required');
        const [claimed] = await this.missedCallModel.update({ called_back_by: operatorUserId }, {
            where: {
                user_uid: userUid,
                caller_id_num: callerIdNum,
                personal: false,
                called_back: false,
                client_called_back: false,
            },
        });
        this.stateService.emitEvent('missedCallUpdate', userUid, {
            callerIdNum,
            claimedBy: operatorUserId,
        });
        return { success: true, claimed };
    }
    /**
     * D-17: when the client calls back on their own and the call connects,
     * tag every open (unresolved) missed row for that number as
     * client_called_back so it drops out of the active worklist.
     */
    async autoResolveOnAnswer(userUid, callerIdNum) {
        if (!callerIdNum)
            return;
        try {
            const [affected] = await this.missedCallModel.update({ client_called_back: true }, {
                where: {
                    user_uid: userUid,
                    caller_id_num: callerIdNum,
                    called_back: false,
                    client_called_back: false,
                },
            });
            if (affected > 0) {
                this.stateService.emitEvent('missedCallUpdate', userUid, {
                    callerIdNum,
                    clientCalledBack: true,
                });
            }
        }
        catch (err) {
            this.logger.warn(`autoResolveOnAnswer failed: ${err.message}`);
        }
    }
    /**
     * D-34/D-35: unified call history across all directions (queue inbound,
     * personal, outbound, internal) for a single operator, most-recent-first.
     * `period='shift'` looks back to the operator's current open login session
     * (falls back to start-of-day if none is open); `period='day'` always uses
     * start-of-day. Tenant-scoped by vpbx_user_uid (T-09-11-03).
     */
    async getOperatorCallHistory(userUid, operatorUserId, period = 'day') {
        let since = this.startOfToday();
        if (period === 'shift') {
            const session = await this.sessionModel.findOne({
                where: { user_id: operatorUserId, user_uid: userUid, logout_time: null },
                order: [['login_time', 'DESC']],
            });
            const loginTime = session?.getDataValue('login_time');
            if (loginTime)
                since = loginTime;
        }
        const rows = await this.queueCallModel.findAll({
            where: {
                user_uid: userUid,
                agent_user_uid: operatorUserId,
                created_at: { [sequelize_2.Op.gte]: since },
            },
            order: [['created_at', 'DESC']],
            limit: 200,
        });
        // Enrich missed rows with the operator who later handled the callback.
        const missedUniqueids = rows
            .filter((r) => {
            const d = r.getDataValue('disposition');
            return d === 'abandoned' || d === 'timeout';
        })
            .map((r) => r.getDataValue('call_uniqueid'))
            .filter(Boolean);
        const handledBy = new Map();
        if (missedUniqueids.length > 0) {
            const missed = await this.missedCallModel.findAll({
                where: {
                    user_uid: userUid,
                    call_uniqueid: { [sequelize_2.Op.in]: missedUniqueids },
                    called_back: true,
                    called_back_by: { [sequelize_2.Op.ne]: null },
                },
                attributes: ['call_uniqueid', 'called_back_by'],
            });
            const handlerIds = [
                ...new Set(missed
                    .map((m) => m.called_back_by)
                    .filter((id) => id != null && id > 0)),
            ];
            const nameById = new Map();
            if (handlerIds.length > 0) {
                const users = await this.userModel.findAll({
                    where: { uniqueid: { [sequelize_2.Op.in]: handlerIds }, vpbx_user_uid: userUid },
                    attributes: ['uniqueid', 'name', 'login', 'exten'],
                });
                for (const u of users) {
                    const id = u.getDataValue('uniqueid');
                    const name = u.getDataValue('name')
                        || u.getDataValue('login')
                        || `#${id}`;
                    const exten = u.getDataValue('exten') || null;
                    nameById.set(id, { name, exten });
                }
            }
            for (const m of missed) {
                const by = m.called_back_by;
                if (by == null || by <= 0)
                    continue;
                const info = nameById.get(by) ?? { name: `#${by}`, exten: null };
                handledBy.set(m.call_uniqueid, info);
            }
        }
        return rows.map((r) => {
            const uniqueid = r.getDataValue('call_uniqueid');
            const handler = handledBy.get(uniqueid);
            return {
                uid: r.getDataValue('uid'),
                callUniqueid: uniqueid,
                queueName: r.getDataValue('queue_name'),
                callerIdNum: r.getDataValue('caller_id_num'),
                callerIdName: r.getDataValue('caller_id_name'),
                direction: r.getDataValue('direction'),
                callType: r.getDataValue('call_type'),
                disposition: r.getDataValue('disposition'),
                transferDestination: r.getDataValue('transfer_destination') || null,
                handledByName: handler?.name ?? null,
                handledByExten: handler?.exten ?? null,
                enterTime: r.getDataValue('enter_time'),
                answerTime: r.getDataValue('answer_time'),
                endTime: r.getDataValue('end_time'),
                waitTime: r.getDataValue('wait_time'),
                talkTime: r.getDataValue('talk_time'),
            };
        });
    }
    // ─── Supervisor access scope / watchlist / multi-agent history ──
    async getSupervisorAccessScope(userUid, supervisorUserId) {
        const scope = await this.accessListService.resolveScope(userUid, supervisorUserId);
        const candidates = await this.accessListService.listCandidateOperators(userUid, scope);
        return {
            ...this.accessListService.serializeScope(scope),
            candidates,
        };
    }
    async getWatchedAgents(userUid, supervisorUserId) {
        const row = await this.operatorSettingsModel.findOne({
            where: { user_uid: userUid, operator_user_id: supervisorUserId },
            attributes: ['supervised_agent_extens'],
        });
        const raw = row?.getDataValue('supervised_agent_extens');
        const userIds = await this.accessListService.mapWatchlistToUserIds(userUid, raw);
        return { userIds };
    }
    async setWatchedAgents(userUid, supervisorUserId, userIdsIn, legacyExtens) {
        const scope = await this.accessListService.resolveScope(userUid, supervisorUserId);
        let userIds = [...new Set((userIdsIn || []).map((id) => Number(id)).filter((id) => id > 0))];
        if (userIds.length === 0 && legacyExtens?.length) {
            userIds = await this.accessListService.mapWatchlistToUserIds(userUid, legacyExtens);
        }
        for (const id of userIds) {
            if (!this.accessListService.isOperatorUserAllowed(scope, id)) {
                throw new common_1.ForbiddenException(`Operator ${id} is outside supervisor access list`);
            }
        }
        const existing = await this.operatorSettingsModel.findOne({
            where: { user_uid: userUid, operator_user_id: supervisorUserId },
        });
        if (existing) {
            await existing.update({
                supervised_agent_extens: userIds.map(String),
                updated_at: new Date(),
            });
        }
        else {
            await this.operatorSettingsModel.create({
                ...callcenter_settings_service_2.DEFAULT_OPERATOR_SETTINGS,
                user_uid: userUid,
                operator_user_id: supervisorUserId,
                supervised_agent_extens: userIds.map(String),
                updated_at: new Date(),
            });
        }
        return { userIds };
    }
    /**
     * Call history for all watched agents (same row shape as getOperatorCallHistory).
     */
    async getSupervisorCallHistory(userUid, supervisorUserId, period = 'day') {
        const { userIds } = await this.getWatchedAgents(userUid, supervisorUserId);
        if (userIds.length === 0)
            return [];
        const operatorIds = [...userIds];
        const since = this.startOfToday();
        // period=shift for supervisor aggregates to day (no single shared shift).
        void period;
        const rows = await this.queueCallModel.findAll({
            where: {
                user_uid: userUid,
                agent_user_uid: { [sequelize_2.Op.in]: operatorIds },
                created_at: { [sequelize_2.Op.gte]: since },
            },
            order: [['created_at', 'DESC']],
            limit: 500,
        });
        const missedUniqueids = rows
            .filter((r) => {
            const d = r.getDataValue('disposition');
            return d === 'abandoned' || d === 'timeout';
        })
            .map((r) => r.getDataValue('call_uniqueid'))
            .filter(Boolean);
        const handledBy = new Map();
        if (missedUniqueids.length > 0) {
            const missed = await this.missedCallModel.findAll({
                where: {
                    user_uid: userUid,
                    call_uniqueid: { [sequelize_2.Op.in]: missedUniqueids },
                    called_back: true,
                    called_back_by: { [sequelize_2.Op.ne]: null },
                },
                attributes: ['call_uniqueid', 'called_back_by'],
            });
            const handlerIds = [
                ...new Set(missed
                    .map((m) => m.called_back_by)
                    .filter((id) => id != null && id > 0)),
            ];
            const nameById = new Map();
            if (handlerIds.length > 0) {
                const handlerUsers = await this.userModel.findAll({
                    where: { uniqueid: { [sequelize_2.Op.in]: handlerIds }, vpbx_user_uid: userUid },
                    attributes: ['uniqueid', 'name', 'login', 'exten'],
                });
                for (const u of handlerUsers) {
                    const id = u.getDataValue('uniqueid');
                    const name = u.getDataValue('name')
                        || u.getDataValue('login')
                        || `#${id}`;
                    const exten = u.getDataValue('exten') || null;
                    nameById.set(id, { name, exten });
                }
            }
            for (const m of missed) {
                const by = m.called_back_by;
                if (by == null || by <= 0)
                    continue;
                const info = nameById.get(by) ?? { name: `#${by}`, exten: null };
                handledBy.set(m.call_uniqueid, info);
            }
        }
        return rows.map((r) => {
            const uniqueid = r.getDataValue('call_uniqueid');
            const handler = handledBy.get(uniqueid);
            return {
                uid: r.getDataValue('uid'),
                callUniqueid: uniqueid,
                queueName: r.getDataValue('queue_name'),
                callerIdNum: r.getDataValue('caller_id_num'),
                callerIdName: r.getDataValue('caller_id_name'),
                direction: r.getDataValue('direction'),
                callType: r.getDataValue('call_type'),
                disposition: r.getDataValue('disposition'),
                transferDestination: r.getDataValue('transfer_destination') || null,
                handledByName: handler?.name ?? null,
                handledByExten: handler?.exten ?? null,
                enterTime: r.getDataValue('enter_time'),
                answerTime: r.getDataValue('answer_time'),
                endTime: r.getDataValue('end_time'),
                waitTime: r.getDataValue('wait_time'),
                talkTime: r.getDataValue('talk_time'),
                agentUserId: r.getDataValue('agent_user_uid'),
            };
        });
    }
    startOfToday() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    // ─── Client Card (lookup by callerIdNum) ──────────────────
    /**
     * Look up a caller and pull the latest service-requests for that number.
     * Directory contacts replace the removed phonebook sidebar in a later task.
     */
    async lookupClient(rawNumber, userUid) {
        const digits = (rawNumber || '').replace(/\D/g, '');
        if (digits.length < 4) {
            return { number: rawNumber, matched: false, contacts: [], requests: [] };
        }
        const suffix = digits.slice(-10);
        const contacts = [];
        // Recent service requests for this number
        const requests = await this.serviceRequestModel.findAll({
            where: {
                user_uid: userUid,
                phone: { [sequelize_2.Op.like]: `%${suffix.slice(-7)}%` },
            },
            order: [['created_at', 'DESC']],
            limit: 10,
            attributes: [
                'uid', 'request_number', 'counterparty_name', 'phone',
                'topic', 'comment', 'address', 'request_status',
                'scheduled_date', 'created_at',
            ],
        });
        return {
            number: rawNumber,
            matched: contacts.length > 0 || requests.length > 0,
            contacts,
            requests: requests
                .map(r => r.get({ plain: true }))
                .filter((r) => (r.phone || '').replace(/\D/g, '').endsWith(suffix)),
        };
    }
    // ─── Transfer Directory (D-36) ────────────────────────────
    /**
     * Unified transfer directory (D-36): internal endpoints (with extension +
     * live presence from the Task-2 CallCenterPresenceService, falling back to
     * CC agent status when the endpoint is a logged-in agent), queues (free
     * count reused from the existing CC-state aggregation — recalcQueueStats'
     * agents.available), and call groups (free count derived by matching each
     * member extension against the live CC agent map). Tenant-scoped by
     * vpbx_user_uid throughout (T-09-11-01).
     */
    async getTransferDirectory(userUid, search) {
        const agents = this.stateService.getAllAgents(userUid);
        const agentByExtension = new Map();
        for (const agent of agents) {
            agentByExtension.set((0, endpoint_ids_util_1.interfaceToExtension)(agent.interface), agent);
        }
        const endpointRows = await this.endpointModel.findAll({
            where: { tenantid: String(userUid) },
            attributes: ['id', 'department'],
        });
        const endpoints = endpointRows
            .filter((ep) => !(0, endpoint_ids_util_1.isWebrtcCompanion)(ep.id))
            .map((ep) => {
            const extension = (0, endpoint_ids_util_1.extractExtension)(ep.id);
            const agent = agentByExtension.get(extension);
            return {
                type: 'endpoint',
                id: ep.id,
                extension,
                label: ep.department || extension,
                presence: this.presenceService.getPresence(userUid, extension) || agent?.status || 'OFFLINE',
            };
        });
        const queueRows = await this.queueModel.findAll({
            where: { user_uid: userUid },
            attributes: ['name', 'display_name'],
        });
        const queues = queueRows.map((q) => {
            const name = q.getDataValue('name');
            const liveQueue = this.stateService.getQueue(userUid, name);
            return {
                type: 'queue',
                id: name,
                label: q.getDataValue('display_name') || name,
                freeOperators: liveQueue?.agents.available ?? 0,
                totalOperators: liveQueue?.agents.total ?? 0,
            };
        });
        const groupRows = await this.callGroupModel.findAll({
            where: { user_uid: userUid },
            attributes: ['uid', 'name'],
        });
        const groupIds = groupRows.map((g) => g.getDataValue('uid'));
        const members = groupIds.length
            ? await this.callGroupMemberModel.findAll({
                where: { call_group_uid: { [sequelize_2.Op.in]: groupIds }, member_type: 'internal' },
                attributes: ['call_group_uid', 'value'],
            })
            : [];
        const membersByGroup = new Map();
        for (const m of members) {
            const groupUid = m.getDataValue('call_group_uid');
            const list = membersByGroup.get(groupUid) || [];
            list.push(m.getDataValue('value'));
            membersByGroup.set(groupUid, list);
        }
        const groups = groupRows.map((g) => {
            const uid = g.getDataValue('uid');
            const extensions = membersByGroup.get(uid) || [];
            const freeOperators = extensions.filter((ext) => agentByExtension.get(ext)?.status === 'READY').length;
            return {
                type: 'group',
                id: String(uid),
                label: g.getDataValue('name'),
                freeOperators,
                totalOperators: extensions.length,
            };
        });
        if (!search)
            return { endpoints, queues, groups };
        const term = search.toLowerCase();
        return {
            endpoints: endpoints.filter((e) => e.extension.toLowerCase().includes(term) || e.label.toLowerCase().includes(term)),
            queues: queues.filter((q) => q.id.toLowerCase().includes(term) || q.label.toLowerCase().includes(term)),
            groups: groups.filter((g) => g.label.toLowerCase().includes(term)),
        };
    }
};
exports.CallCenterService = CallCenterService;
exports.CallCenterService = CallCenterService = CallCenterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, sequelize_1.InjectModel)(pause_reason_model_1.CcPauseReason)),
    __param(5, (0, sequelize_1.InjectModel)(agent_session_model_1.CcAgentSession)),
    __param(6, (0, sequelize_1.InjectModel)(agent_event_model_1.CcAgentEvent)),
    __param(7, (0, sequelize_1.InjectModel)(queue_call_model_1.CcQueueCall)),
    __param(8, (0, sequelize_1.InjectModel)(missed_call_model_1.CcMissedCall)),
    __param(9, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(10, (0, sequelize_1.InjectModel)(service_request_model_1.ServiceRequest)),
    __param(14, (0, sequelize_1.InjectModel)(queue_model_1.Queue)),
    __param(15, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __param(16, (0, sequelize_1.InjectModel)(call_group_model_1.CallGroup)),
    __param(17, (0, sequelize_1.InjectModel)(call_group_member_model_1.CallGroupMember)),
    __param(19, (0, sequelize_1.InjectModel)(cc_contact_model_1.CcContact)),
    __param(20, (0, sequelize_1.InjectModel)(operator_settings_model_1.CcOperatorSettings)),
    __metadata("design:paramtypes", [ami_service_1.AmiService,
        callcenter_state_service_1.CallCenterStateService,
        callcenter_ami_service_1.CallCenterAmiService,
        callcenter_metrics_service_1.CallCenterMetricsService, Object, Object, Object, Object, Object, Object, Object, callcenter_settings_service_1.CallCenterSettingsService,
        callcenter_permissions_service_1.CallCenterPermissionsService,
        logger_service_1.LoggerService, Object, Object, Object, Object, callcenter_presence_service_1.CallCenterPresenceService, Object, Object, callcenter_access_list_service_1.CallCenterAccessListService,
        callcenter_shift_restore_service_1.CallCenterShiftRestoreService,
        conference_ephemeral_service_1.ConferenceEphemeralService])
], CallCenterService);
//# sourceMappingURL=callcenter.service.js.map