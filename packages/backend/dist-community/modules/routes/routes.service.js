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
var RoutesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutesService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const shared_1 = require("@krasterisk/shared");
const route_model_1 = require("./route.model");
const route_directory_binding_model_1 = require("../directories/route-directory-binding.model");
const directory_model_1 = require("../directories/directory.model");
const directory_field_model_1 = require("../directories/directory-field.model");
const time_groups_service_1 = require("../time-groups/time-groups.service");
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
const route_recording_util_1 = require("./route-recording.util");
const route_dialplan_source_util_1 = require("./route-dialplan-source.util");
const action_params_validation_util_1 = require("../../shared/pipes/action-params-validation.util");
const BINDING_INCLUDE = {
    model: route_directory_binding_model_1.RouteDirectoryBinding,
    as: 'bindings',
    include: [{ model: directory_model_1.Directory, as: 'directory' }],
};
const BINDING_ORDER = [{ model: route_directory_binding_model_1.RouteDirectoryBinding, as: 'bindings' }, 'position', 'ASC'];
function collectBindingFieldUids(binding) {
    const params = binding.behavior_params || {};
    const uids = [];
    if (typeof params.fieldUid === 'number')
        uids.push(params.fieldUid);
    for (const mapping of params.mappings ?? []) {
        if (typeof mapping.fieldUid === 'number')
            uids.push(mapping.fieldUid);
    }
    return Array.from(new Set(uids));
}
function asPositiveInt(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0)
        return value;
    return undefined;
}
/** Directory/field UIDs nested in route or custom-policy action JSON. */
function collectActionDirectoryRefs(nodes) {
    const directoryUids = new Set();
    const fieldsByDirectory = new Map();
    const addField = (directoryUid, fieldUid) => {
        const set = fieldsByDirectory.get(directoryUid) ?? new Set();
        set.add(fieldUid);
        fieldsByDirectory.set(directoryUid, set);
    };
    const walk = (node, nearestDir) => {
        if (node == null)
            return;
        if (Array.isArray(node)) {
            for (const item of node)
                walk(item, nearestDir);
            return;
        }
        if (typeof node !== 'object')
            return;
        const rec = node;
        const ownDir = asPositiveInt(rec.directoryUid) ?? asPositiveInt(rec.directory_uid);
        const dir = ownDir ?? nearestDir;
        if (ownDir != null)
            directoryUids.add(ownDir);
        const fieldUid = asPositiveInt(rec.valueFieldUid) ?? asPositiveInt(rec.fieldUid);
        if (fieldUid != null && dir != null)
            addField(dir, fieldUid);
        for (const child of Object.values(rec)) {
            if (child && typeof child === 'object')
                walk(child, dir);
        }
    };
    for (const node of nodes)
        walk(node);
    return {
        directoryUids: Array.from(directoryUids),
        fieldsByDirectory: new Map(Array.from(fieldsByDirectory.entries()).map(([uid, fields]) => [uid, Array.from(fields)])),
    };
}
let RoutesService = RoutesService_1 = class RoutesService {
    routeModel;
    bindingModel;
    directoryModel;
    fieldModel;
    timeGroupsService;
    logger = new common_1.Logger(RoutesService_1.name);
    constructor(routeModel, bindingModel, directoryModel, fieldModel, timeGroupsService) {
        this.routeModel = routeModel;
        this.bindingModel = bindingModel;
        this.directoryModel = directoryModel;
        this.fieldModel = fieldModel;
        this.timeGroupsService = timeGroupsService;
    }
    /** Get all routes for the tenant */
    async findAll(vpbxUserUid) {
        return this.routeModel.findAll({
            where: { user_uid: vpbxUserUid },
            include: [BINDING_INCLUDE],
            order: [['context_uid', 'ASC'], ['priority', 'ASC'], ['uid', 'ASC'], BINDING_ORDER],
        });
    }
    /** Get all routes for a specific context */
    async findAllByContext(contextUid, vpbxUserUid) {
        return this.routeModel.findAll({
            where: { context_uid: contextUid, user_uid: vpbxUserUid },
            include: [BINDING_INCLUDE],
            order: [['priority', 'ASC'], ['uid', 'ASC'], BINDING_ORDER],
        });
    }
    /** Get a single route by ID */
    async findOne(uid, vpbxUserUid) {
        const route = await this.routeModel.findOne({
            where: { uid, user_uid: vpbxUserUid },
            include: [BINDING_INCLUDE],
            order: [BINDING_ORDER],
        });
        if (!route)
            throw new common_1.NotFoundException('Route not found');
        return route;
    }
    /**
     * Ensure every referenced directory and field belongs to this tenant
     * and that field UIDs belong to the binding's directory.
     */
    async validateBindingsOwnership(bindings, vpbxUserUid) {
        const directoryUids = Array.from(new Set(bindings.map((b) => b.directory_uid)));
        if (directoryUids.length === 0)
            return;
        const count = await this.directoryModel.count({ where: { uid: directoryUids, user_uid: vpbxUserUid } });
        if (count !== directoryUids.length) {
            throw new common_1.BadRequestException('One or more directories are invalid or belong to another tenant');
        }
        for (const binding of bindings) {
            const fieldUids = collectBindingFieldUids(binding);
            if (fieldUids.length === 0)
                continue;
            const fieldCount = await this.fieldModel.count({
                where: { uid: fieldUids, directory_uid: binding.directory_uid },
            });
            if (fieldCount !== fieldUids.length) {
                throw new common_1.BadRequestException('One or more directory fields are invalid or do not belong to the selected directory');
            }
        }
    }
    /**
     * Spec §11: action save/apply validates directory and field UIDs on
     * route.actions and custom policy actions (same ownership rules as bindings).
     */
    async validateActionDirectoryOwnership(actions, vpbxUserUid) {
        const { directoryUids, fieldsByDirectory } = collectActionDirectoryRefs(actions);
        if (directoryUids.length === 0)
            return;
        const count = await this.directoryModel.count({ where: { uid: directoryUids, user_uid: vpbxUserUid } });
        if (count !== directoryUids.length) {
            throw new common_1.BadRequestException('One or more directories are invalid or belong to another tenant');
        }
        for (const [directoryUid, fieldUids] of fieldsByDirectory) {
            if (fieldUids.length === 0)
                continue;
            const fieldCount = await this.fieldModel.count({
                where: { uid: fieldUids, directory_uid: directoryUid },
            });
            if (fieldCount !== fieldUids.length) {
                throw new common_1.BadRequestException('One or more directory fields are invalid or do not belong to the selected directory');
            }
        }
    }
    async validateSavedActionOwnership(actions, bindings, vpbxUserUid) {
        const chains = [];
        if (Array.isArray(actions))
            chains.push(...actions);
        if (bindings) {
            for (const binding of bindings) {
                if (Array.isArray(binding.actions))
                    chains.push(...binding.actions);
            }
        }
        if (chains.length === 0)
            return;
        await this.validateActionDirectoryOwnership(chains, vpbxUserUid);
    }
    /** Replace-all strategy for a route's directory policies. */
    async replaceBindings(routeUid, bindings, vpbxUserUid) {
        await this.validateBindingsOwnership(bindings, vpbxUserUid);
        await this.bindingModel.destroy({ where: { route_uid: routeUid, user_uid: vpbxUserUid } });
        if (bindings.length > 0) {
            await this.bindingModel.bulkCreate(bindings.map((b, index) => ({
                route_uid: routeUid,
                directory_uid: b.directory_uid,
                position: index,
                key_source: b.key_source,
                match_mode: b.match_mode || 'on_match',
                behavior_type: b.behavior_type,
                behavior_params: b.behavior_params ?? null,
                actions: b.actions ?? null,
                user_uid: vpbxUserUid,
            })));
        }
    }
    /** Create a new route */
    async create(data, vpbxUserUid) {
        const { bindings, ...rest } = data;
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)({ actions: rest.actions });
        await this.validateSavedActionOwnership(rest.actions, bindings, vpbxUserUid);
        // Get the next priority
        const maxPriority = await this.routeModel.max('priority', {
            where: { context_uid: rest.context_uid, user_uid: vpbxUserUid },
        });
        const payload = { ...rest };
        if (payload.raw_dialplan?.trim()) {
            payload.raw_dialplan = (0, shared_1.ensureCdrVpbxUserUidInDialplan)(payload.raw_dialplan, vpbxUserUid);
        }
        const route = await this.routeModel.create({
            ...payload,
            priority: (maxPriority || 0) + 1,
            user_uid: vpbxUserUid,
        });
        if (bindings !== undefined) {
            await this.replaceBindings(route.uid, bindings, vpbxUserUid);
        }
        return this.findOne(route.uid, vpbxUserUid);
    }
    /** Update an existing route */
    async update(uid, data, vpbxUserUid) {
        const route = await this.findOne(uid, vpbxUserUid);
        const { bindings, ...rest } = data;
        if (rest.actions !== undefined) {
            (0, action_params_validation_util_1.throwIfInvalidActionPayload)({ actions: rest.actions });
        }
        await this.validateSavedActionOwnership(rest.actions, bindings, vpbxUserUid);
        const payload = { ...rest };
        if (payload.raw_dialplan?.trim()) {
            payload.raw_dialplan = (0, shared_1.ensureCdrVpbxUserUidInDialplan)(payload.raw_dialplan, vpbxUserUid);
        }
        else if (payload.raw_dialplan !== undefined && !payload.raw_dialplan?.trim()) {
            payload.raw_dialplan = null;
        }
        await route.update(payload);
        if (bindings !== undefined) {
            await this.replaceBindings(uid, bindings, vpbxUserUid);
        }
        return this.findOne(uid, vpbxUserUid);
    }
    /** Delete a route */
    async remove(uid, vpbxUserUid) {
        const route = await this.findOne(uid, vpbxUserUid);
        await route.destroy(); // CASCADE deletes bindings
    }
    /** Reorder routes within a context */
    async reorder(contextUid, orderedIds, vpbxUserUid) {
        const promises = orderedIds.map((id, index) => this.routeModel.update({ priority: index }, { where: { uid: id, context_uid: contextUid, user_uid: vpbxUserUid } }));
        await Promise.all(promises);
    }
    /** Duplicate a route (bindings are copied — directory_uid/key_source/behavior, not uid/route_uid) */
    async duplicate(uid, vpbxUserUid) {
        const source = await this.findOne(uid, vpbxUserUid);
        const data = source.toJSON();
        delete data.uid;
        delete data.created_at;
        delete data.updated_at;
        data.name = `Копия - ${data.name}`;
        return this.create(data, vpbxUserUid);
    }
    /** Format a single TimeGroup interval for ExecIfTime (shared with schedule action). */
    formatTimeGroupInterval(interval) {
        return (0, dialplan_util_1.formatTimeGroupInterval)(interval);
    }
    /** Build uid → ExecIfTime interval expressions map from tenant time groups. */
    buildTimeGroupIntervalMap(timeGroups) {
        const map = new Map();
        for (const tg of timeGroups) {
            const exprs = (tg.intervals || []).map((i) => this.formatTimeGroupInterval(i));
            if (exprs.length)
                map.set(tg.uid, exprs);
        }
        return map;
    }
    /**
     * Generate raw dialplan text from JSON actions for a single route.
     * This produces Asterisk-compatible dialplan configuration.
     */
    generateRouteDialplan(route, vpbxUserUid, isAdmin = false, timeGroupIntervals = new Map()) {
        if ((0, route_dialplan_source_util_1.shouldUseStoredRawDialplan)(route)) {
            return (0, shared_1.ensureCdrVpbxUserUidInDialplan)(route.raw_dialplan, vpbxUserUid);
        }
        const lines = [];
        const extensions = route.extensions || [];
        const actions = route.actions || [];
        const opts = route.options || {};
        const callbackStep = actions.find((action) => action.type === 'callback');
        dialplan_util_1.AsteriskDialplanUtils.hasCallbackStep = !!callbackStep;
        const routeWebhooks = (route.webhooks || {});
        const wh = {
            ...routeWebhooks,
            has_callback_step: !!callbackStep,
            callback_policy: dialplan_util_1.AsteriskDialplanUtils.callbackPolicy,
            callback_window_start: callbackStep?.params?.window_start,
            callback_window_end: callbackStep?.params?.window_end,
            callback_max_attempts: callbackStep?.params?.max_attempts,
            callback_pause_minutes: callbackStep?.params?.pause_minutes,
        };
        const backendUrl = dialplan_util_1.AsteriskDialplanUtils.backendBaseUrl;
        const apiKey = dialplan_util_1.AsteriskDialplanUtils.dialplanApiKey;
        const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
        const bindings = route.bindings || [];
        const orderedBindings = bindings.slice().sort((a, b) => a.position - b.position);
        for (const ext of extensions) {
            lines.push(`exten => ${ext},1,NoOp(Route: ${route.name})`);
            lines.push(`same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`);
            lines.push(`same => n,Set(__HH_ROUTE_UID=${route.uid})`);
            lines.push('same => n,ExecIf($["${ORIGUNIQUEID}" = ""]?Set(__ORIGUNIQUEID=${UNIQUEID}))');
            lines.push('same => n,ExecIf($["${ORIGEXTEN}" = ""]?Set(__ORIGEXTEN=${EXTEN}))');
            lines.push('same => n,ExecIf($["${ORIGCLIDNUM}" = ""]?Set(__ORIGCLIDNUM=${CALLERID(num)}))');
            lines.push('same => n,ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_NUM=${CALLERID(num)}))');
            lines.push('same => n,ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_CAPTURED=1))');
            lines.push('same => n,Set(__CLIDNUM=${CALLERID(num)})');
            lines.push('same => n,Set(CDR(usrc)=${CLIDNUM})');
            lines.push('same => n,Set(__STARTTIME=${EPOCH})');
            // --- Webhook flag variables ---
            // Double underscore (__) ensures inheritance into all child channels (Local/, Queue member, etc.)
            // Flags are set ONLY when a webhook URL is configured — avoids CURL overhead for routes without webhooks
            if (wh.before_dial?.url)
                lines.push('same => n,Set(__WH_BD=1)');
            if (wh.on_answer?.url)
                lines.push('same => n,Set(__WH_OA=1)');
            if (wh.on_hangup?.url)
                lines.push('same => n,Set(__WH_OH=1)');
            if (wh.custom?.url)
                lines.push('same => n,Set(__WH_CUSTOM=1)');
            // Pre-command
            if (opts.pre_command) {
                lines.push(`same => n,${opts.pre_command}`);
            }
            // --- Call recording (ffmpeg instead of lame) ---
            // ffmpeg: faster startup, better quality control, maintained project, supports more formats
            // Mono: -codec:a libmp3lame -b:a 32k -ar 8000 -ac 1 — telephony quality WAV → MP3
            // Stereo: MixMonitor `D` writes interleaved RX/TX to .raw; ffmpeg converts to stereo MP3
            // nice -n 10: low-priority background process, does not affect Asterisk real-time performance
            // MixMonitor postprocess (&) is fire-and-forget — conversion happens AFTER channel hangs up
            if (opts.record) {
                const recordStereo = opts.record_stereo === true;
                const recExt = (0, route_recording_util_1.getRecordingSourceExtension)(recordStereo);
                const monFlag = (0, route_recording_util_1.buildMixMonitorFlags)({
                    record_all: opts.record_all === true,
                    record_stereo: recordStereo,
                });
                const durableCapture = process.env.DURABLE_CAPTURE === '1';
                lines.push('same => n,Set(__path=${STRFTIME(${EPOCH},,%Y%m%d)})');
                const rpath = `${vpbxUserUid}/calls`;
                if (durableCapture) {
                    lines.push('same => n,Set(__DURABLE_CAPTURE=1)');
                    lines.push('same => n,Set(__fname=${SHELL(cat /proc/sys/kernel/random/uuid | tr -d \\\\n)})');
                    lines.push('same => n,Set(__RECORDER_ID=${fname})');
                    const recBase = `/usr/records/${rpath}/\${path}/\${fname}`;
                    if (recordStereo)
                        lines.push('same => n,Set(__REC_STEREO=1)');
                    lines.push(`same => n,Set(CDR(record)=${rpath}/\${path}/\${fname})`);
                    lines.push(`same => n,${(0, route_recording_util_1.mixMonitorWithRecorderId)(`${recBase}.${recExt}`, monFlag, '${RECORDER_ID}')}`);
                }
                else {
                    // Sanitize CALLERID(num): keep only digits and + (path-safe filename fragment)
                    lines.push('same => n,Set(__safeclid=${FILTER(0-9+,${CALLERID(num)})})');
                    lines.push('same => n,Set(__fname=${STRFTIME(${EPOCH},,%Y%m%d%H%M%S)}-${safeclid}-${EXTEN})');
                    const recBase = `/usr/records/${rpath}/\${path}/\${fname}`;
                    if (recordStereo) {
                        lines.push('same => n,Set(__REC_STEREO=1)');
                    }
                    // ffmpeg conversion + source cleanup as MixMonitor postprocess (runs after hangup in background)
                    // Note: if on_hangup webhook is set, hangup_handler (set below) will handle conversion
                    // and ensure MP3 is ready before notifying the backend. Otherwise use postprocess directly.
                    if (!wh.on_hangup?.url) {
                        lines.push(`same => n,Set(__monopt=${(0, route_recording_util_1.buildFfmpegPostprocess)(recBase, recordStereo)})`);
                        lines.push(`same => n,Set(CDR(record)=${rpath}/\${path}/\${fname})`);
                        lines.push(`same => n,MixMonitor(${recBase}.${recExt},${monFlag},\${monopt})`);
                    }
                    else {
                        // on_hangup is configured: MixMonitor WITHOUT postprocess — hangup_handler takes over
                        // This guarantees MP3 is ready before the on_hangup webhook fires
                        lines.push(`same => n,Set(CDR(record)=${rpath}/\${path}/\${fname})`);
                        lines.push(`same => n,MixMonitor(${recBase}.${recExt},${monFlag})`);
                    }
                }
            }
            // --- Hangup handler registration ---
            // Registered when: on_hangup webhook needs notification, OR recording needs guaranteed MP3 conversion
            // hangup_handler_push executes [krsk-hangup-handler] on channel teardown (even on Hangup())
            // Covers: ffmpeg conversion + on_hangup webhook CURL (only if WH_OH=1)
            if (wh.on_hangup?.url || (opts.record && wh.on_hangup?.url)) {
                lines.push('same => n,Set(CHANNEL(hangup_handler_push)=krsk-hangup-handler,s,1)');
            }
            // Directory policy chain (cascading Gosub/Return), ordered by position ASC
            for (const binding of orderedBindings) {
                lines.push(`same => n,Gosub(dir_policy_${binding.uid}_${vpbxUserUid},s,1)`);
            }
            // Legacy blacklist check (backward compat — only when no directory policy replaces it)
            if (opts.check_blacklist && orderedBindings.length === 0) {
                lines.push(`same => n,ExecIf($["\${SHELL(/usr/scripts/check_blacklist.php "\${CALLERID(num)}" "${vpbxUserUid}")}" != ""]?hangup())`);
            }
            // Listbook name lookup
            if (opts.check_listbook) {
                lines.push(`same => n,ExecIf($["\${SHELL(/usr/scripts/check_listbook.php "\${CALLERID(num)}" "${vpbxUserUid}")}" != ""]?Set(CALLERID(name)=\${SHELL(/usr/scripts/check_listbook.php "\${CALLERID(num)}" "${vpbxUserUid}")}))`);
            }
            // --- Custom webhook (DIALTO) ---
            // Synchronous: Asterisk waits for response (timeout: 4s via CURLOPT)
            // Backend returns the responsible employee's internal extension (digits only) or empty string
            // __DIALTO: double underscore ensures it's inherited by child channels
            if (wh.custom?.url) {
                lines.push('same => n,Set(CURLOPT(conntimeout)=3)');
                lines.push('same => n,Set(CURLOPT(timeout)=4)');
                lines.push(`same => n,Set(__DIALTO=\${CURL(${backendUrl}/internal/dialplan/custom-webhook,route_uid=\${HH_ROUTE_UID}&uniqueid=\${URIENCODE(\${UNIQUEID})}&clid=\${URIENCODE(\${CALLERID(num)})}&user_uid=${vpbxUserUid}${keyParam})})`);
                // Reset CURLOPT to defaults for subsequent CURL calls
                lines.push('same => n,Set(CURLOPT(conntimeout)=)');
                lines.push('same => n,Set(CURLOPT(timeout)=)');
            }
            // --- Before-dial webhook ---
            // Synchronous: fires before Dial/Queue — CRM can register the call, set CallerID name, etc.
            // Timeout is intentionally short (3s connect / 5s total) — a slow CRM should not block calls
            if (wh.before_dial?.url) {
                lines.push('same => n,ExecIf($["${WH_BD}" = "1"]?Set(CURLOPT(conntimeout)=3))');
                lines.push('same => n,ExecIf($["${WH_BD}" = "1"]?Set(CURLOPT(timeout)=5))');
                lines.push(`same => n,ExecIf($["\${WH_BD}" = "1"]?Set(WH_BD_RESULT=\${CURL(${backendUrl}/internal/dialplan/before-dial,route_uid=\${HH_ROUTE_UID}&uniqueid=\${URIENCODE(\${UNIQUEID})}&clid=\${URIENCODE(\${CALLERID(num)})}&exten=\${URIENCODE(\${EXTEN})}&user_uid=${vpbxUserUid}${keyParam})}))`);
                lines.push('same => n,Set(CURLOPT(conntimeout)=)');
                lines.push('same => n,Set(CURLOPT(timeout)=)');
            }
            // --- Actions ---
            // Collect distinct time_group_uid values and emit inline ExecIfTime guards once per uid (D-19)
            const guardedUids = new Set();
            for (const action of actions) {
                const tgUid = action.condition?.time_group_uid;
                if (typeof tgUid === 'number')
                    guardedUids.add(tgUid);
            }
            for (const uid of guardedUids) {
                const intervalExprs = timeGroupIntervals.get(uid);
                if (!intervalExprs?.length) {
                    this.logger.warn(`Route ${route.uid}: time_group_uid ${uid} not found or has no intervals — action unguarded`);
                    lines.push(`same => n,NoOp(Warning: time group ${uid} not found — action unguarded)`);
                    continue;
                }
                lines.push(`same => n,Set(__WT_${uid}=0)`);
                for (const expr of intervalExprs) {
                    lines.push(`same => n,ExecIfTime(${expr}?Set(__WT_${uid}=1))`);
                }
            }
            // Pass webhooks context so Dial/Queue actions can add U()/gosub for on_answer
            for (const action of actions) {
                const tgUid = action.condition?.time_group_uid;
                const hasTg = typeof tgUid === 'number' && !!timeGroupIntervals.get(tgUid)?.length;
                const dp = (0, dialplan_util_1.renderActionChain)([action], {
                    vpbxUserUid,
                    host: 'route',
                    isAdmin,
                    wh,
                    timeGroup: hasTg ? `"\${WT_${tgUid}}"="1"` : undefined,
                });
                if (!dp)
                    continue;
                lines.push((0, dialplan_util_1.prefixSamePriority)(dp));
            }
            lines.push(''); // blank line between extensions
        }
        return lines.join('\n');
    }
    buildContextName(contextName, vpbxUserUid) {
        const suffix = String(vpbxUserUid);
        return contextName.endsWith(suffix) ? contextName : `${contextName}${suffix}`;
    }
    /**
     * Generate the full dialplan for a context (all routes + includes).
     */
    async generateContextDialplan(contextUid, vpbxUserUid, contextName, includes, isAdmin = false) {
        const routes = await this.findAllByContext(contextUid, vpbxUserUid);
        const timeGroups = await this.timeGroupsService.findAll(vpbxUserUid);
        const timeGroupIntervals = this.buildTimeGroupIntervalMap(timeGroups);
        const lines = [];
        const tenantedContextName = this.buildContextName(contextName, vpbxUserUid);
        lines.push(`[${tenantedContextName}]`);
        // Includes
        for (const inc of includes) {
            lines.push(`include => ${this.buildContextName(inc, vpbxUserUid)}`);
        }
        if (includes.length > 0)
            lines.push('');
        // Routes
        for (const route of routes) {
            if (!route.active)
                continue;
            lines.push(`; --- ${route.name} ---`);
            lines.push(this.generateRouteDialplan(route, vpbxUserUid, isAdmin, timeGroupIntervals));
        }
        return lines.join('\n');
    }
    /** Bulk delete routes */
    async bulkRemove(uids, vpbxUserUid) {
        const deleted = await this.routeModel.destroy({
            where: { uid: uids, user_uid: vpbxUserUid },
        });
        return { deleted };
    }
};
exports.RoutesService = RoutesService;
exports.RoutesService = RoutesService = RoutesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(route_model_1.Route)),
    __param(1, (0, sequelize_1.InjectModel)(route_directory_binding_model_1.RouteDirectoryBinding)),
    __param(2, (0, sequelize_1.InjectModel)(directory_model_1.Directory)),
    __param(3, (0, sequelize_1.InjectModel)(directory_field_model_1.DirectoryField)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, time_groups_service_1.TimeGroupsService])
], RoutesService);
//# sourceMappingURL=routes.service.js.map