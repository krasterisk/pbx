"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsteriskDialplanUtils = void 0;
exports.emitDigitExitTransition = emitDigitExitTransition;
exports.findUnreachableSteps = findUnreachableSteps;
exports.formatTimeGroupInterval = formatTimeGroupInterval;
exports.prefixSamePriority = prefixSamePriority;
exports.renderActionChain = renderActionChain;
const shared_1 = require("@krasterisk/shared");
const action_log_model_1 = require("../../modules/logger/action-log.model");
const dialplan_target_util_1 = require("./dialplan-target.util");
const directory_lookup_dialplan_util_1 = require("./directory-lookup-dialplan.util");
const dialplan_number_util_1 = require("./dialplan-number.util");
const dialplan_condition_util_1 = require("./dialplan-condition.util");
const dialplan_hops_util_1 = require("./dialplan-hops.util");
const dialplan_playback_util_1 = require("./dialplan-playback.util");
const dialplan_curl_util_1 = require("./dialplan-curl.util");
const dialplan_http_util_1 = require("./dialplan-http.util");
const dialplan_trunk_carousel_util_1 = require("./dialplan-trunk-carousel.util");
const ari_app_name_1 = require("../../modules/ari/ari-app-name");
const ari_event_classifier_1 = require("../../modules/ari/ari-event-classifier");
const conference_dialplan_util_1 = require("../../modules/conferences/conference-dialplan.util");
const queue_dialplan_util_1 = require("../../modules/queues/queue-dialplan.util");
function compileDirectorySrc(src, token, userUid) {
    if (src.source !== 'directory') {
        return { lines: [], canExecuteExpr: '$[1]', skip: false };
    }
    const compiled = (0, directory_lookup_dialplan_util_1.compileDirectoryValueSource)(src, token, userUid, AsteriskDialplanUtils.backendBaseUrl, AsteriskDialplanUtils.dialplanApiKey);
    return {
        lines: compiled.lines,
        valueVar: compiled.valueVars.get(src.valueFieldUid),
        canExecuteExpr: compiled.canExecuteExpr,
        skip: src.onMissing === 'skip',
    };
}
function gateSkip(skip, expr, app) {
    return skip ? `ExecIf(${expr}?${app})` : app;
}
function logCmdApply(action, vpbxUserUid) {
    const command = String(action?.params?.command ?? '');
    const actionId = typeof action?.id === 'number' ? action.id : typeof action?.uid === 'number' ? action.uid : null;
    const details = JSON.stringify({
        actionId,
        type: 'cmd',
        command: command.slice(0, 80),
    });
    void action_log_model_1.ActionLog.create({
        user_id: 0,
        action: 'cmd_apply',
        entity_type: 'dialplan_action',
        entity_id: actionId,
        user_uid: vpbxUserUid,
        details,
        status: 'success',
    }).catch(() => undefined);
}
class AsteriskDialplanUtils {
    /**
     * Base URL of the Krasterisk backend API **as seen from Asterisk**.
     * Configured via DIALPLAN_BACKEND_URL env variable.
     * Must be reachable from the Asterisk server (may differ from localhost).
     *
     * Examples:
     *   - Same server:  http://127.0.0.1:5010/api
     *   - Remote:       https://pbx-backend.example.com/api
     */
    static backendBaseUrl = process.env.DIALPLAN_BACKEND_URL
        || `http://127.0.0.1:${process.env.BACKEND_PORT || 5010}/api`;
    /** API key for internal dialplan requests (matches DIALPLAN_API_KEY env) */
    static dialplanApiKey = process.env.DIALPLAN_API_KEY || '';
    /** Tenant callback_policy applied during route regen (D-38). */
    static callbackPolicy = null;
    static hasCallbackStep = false;
    /**
     * Conversation-recording volume (D-72). Callers may inject system_settings
     * before generate; otherwise RECORDS_BASE_PATH then `/usr/records`.
     */
    static recordsBasePath = process.env.RECORDS_BASE_PATH || '/usr/records';
    /**
     * Sanitize input to prevent OS shell injection.
     * Strips: ; | & $ ` \ " ' \n \r
     * Use for params that previously ended up in host command execution.
     */
    static sanitizeShellInput(input) {
        if (!input)
            return '';
        return input.replace(/[;|&$`\\"'\n\r]/g, '').trim();
    }
    /**
     * Sanitize input to prevent Asterisk dialplan injection.
     * Strips: ( ) , ? [ ] { } $ \ " \n \r ;
     * Use for params that end up inside dialplan expressions (Dial, Set, Goto, etc).
     */
    static sanitizeDialplanInput(input) {
        if (!input)
            return '';
        return input.replace(/[(),?\[\]{}\$\\";\n\r]/g, '').trim();
    }
    /**
     * Build PJSIP Dial() target for an internal extension.
     * When webrtc is true (default), forks primary + companion so desk phone and browser ring together.
     * Missing companion yields CHANUNAVAIL on that leg; Dial continues on the other.
     *
     * @param extenExpr literal extension ("110") or dialplan expr ("${EXTEN}", "${DIALTO}") — already sanitized
     */
    static pjsipDialTarget(extenExpr, vpbxUserUid, opts) {
        const primary = `PJSIP/e${extenExpr}_${vpbxUserUid}`;
        if (opts?.webrtc === false)
            return primary;
        return `${primary}&PJSIP/ew${extenExpr}_${vpbxUserUid}`;
    }
    /**
     * Sanitize file path to prevent path traversal.
     * Strips: / \ .. and null bytes.
     * Use for params that reference sound/prompt files.
     */
    static sanitizeFilePath(input) {
        if (!input)
            return '';
        return input
            .replace(/\.\./g, '') // remove directory traversal
            .replace(/[\/\\]/g, '') // remove path separators
            .replace(/\0/g, '') // remove null bytes
            .trim();
    }
    /**
     * Sanitize template text that may contain ${VAR} Asterisk channel variables.
     * Used for sendmail subject/text where users can embed dialplan variables.
     *
     * Allows:  ${CALLERID(num)}, ${EXTEN}, ${STRFTIME(...)}, ${CDR(...)}, etc.
     * Blocks host-exec Asterisk functions (shell / system / agi / trysystem).
     * Strips:  \n, \r (prevent dialplan line injection)
     *          ;  (prevent dialplan comment injection)
     *          \  (prevent escape sequences)
     */
    static sanitizeTemplate(input) {
        if (!input)
            return '';
        return input
            // 1. Strip newlines — each Set() must be a single dialplan line
            .replace(/[\n\r]/g, ' ')
            // 2. Strip semicolons — prevent dialplan comments that truncate the line
            .replace(/;/g, '')
            // 3. Strip backslashes — prevent escape sequences
            .replace(/\\/g, '')
            // 4. Block dangerous Asterisk functions that execute OS commands
            //    Case-insensitive block of host-exec Asterisk functions.
            .replace(/\$\{\s*(SHELL|SYSTEM|AGI|TrySystem)\s*\(/gi, '${BLOCKED_')
            .trim();
    }
    /** Convert a single JSON action to dialplan text.
     *
     * @param action   - Action descriptor from route.actions JSON
     * @param vpbxUserUid - Tenant ID
     * @param isAdmin  - Allow admin-only actions (cmd)
     * @param wh       - Route webhooks config (optional); used to inject U()/gosub for on_answer
     */
    static actionToDialplan(action, vpbxUserUid, isAdmin = false, wh = {}) {
        const { type, params = {}, condition = {} } = action;
        let dp = '';
        // Legacy single-string invalid → NoOp warning (preserves prior behavior)
        const invalidStatus = (0, dialplan_condition_util_1.isLegacyInvalidDialstatus)(condition);
        if (invalidStatus) {
            return `NoOp(Invalid dialstatus: ${this.sanitizeDialplanInput(invalidStatus)})`;
        }
        switch (type) {
            case 'totrunk': {
                const destSrc = (0, dialplan_target_util_1.resolveValueSource)(params, 'dest');
                const destLookup = compileDirectorySrc(destSrc, (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'TT'), vpbxUserUid);
                const prelude = [...destLookup.lines];
                const compiled = (0, dialplan_number_util_1.compileDialTargetRewrite)((0, dialplan_number_util_1.sourceExprFromValueSource)(destSrc, destLookup.valueVar) || '${EXTEN}', (0, dialplan_number_util_1.rewriteFromParams)(params), 'phone');
                const dialOpts = this.buildDialOptions(params.options || 'tT', wh);
                const trunksRaw = Array.isArray(params.trunks) ? params.trunks : [];
                const useTrunksList = trunksRaw.length > 0
                    || params.trunkMode === 'carousel';
                if (useTrunksList) {
                    const carousel = (0, dialplan_trunk_carousel_util_1.buildTrunkCarousel)((0, dialplan_trunk_carousel_util_1.mapTrunkCarouselItems)(trunksRaw), {
                        mode: params.mode,
                        timeout: params.timeout,
                        options: params.options,
                        dest: compiled.destExpr || '${EXTEN}',
                        backendBaseUrl: this.backendBaseUrl,
                        dialplanApiKey: this.dialplanApiKey,
                        vpbxUserUid,
                    });
                    dp = [...prelude, ...compiled.lines, carousel].join('\nsame => n,');
                    break;
                }
                const dest = compiled.destExpr || '${EXTEN}';
                const trunk = this.sanitizeDialplanInput(params.trunk) || '';
                const timeout = parseInt(params.timeout, 10) || 60;
                const dialLines = [];
                const callerId = params.callerId;
                if (callerId?.mode === 'directory') {
                    const compiledCid = (0, directory_lookup_dialplan_util_1.compileDirectoryLookup)({
                        token: (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'TTCID'),
                        directoryUid: Number(callerId.directoryUid),
                        userUid: vpbxUserUid,
                        keySource: { source: 'original_caller' },
                        fieldUids: [Number(callerId.valueFieldUid)],
                        onMissing: 'keep',
                        backendBaseUrl: this.backendBaseUrl,
                        apiKey: this.dialplanApiKey,
                    });
                    const valueVar = compiledCid.valueVars.get(Number(callerId.valueFieldUid));
                    dialLines.push(...compiledCid.lines);
                    dialLines.push('Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})');
                    if (valueVar) {
                        dialLines.push(`ExecIf($["\${${compiledCid.statusVar}}" = "FOUND" & "\${${valueVar}}" != ""]?Set(CALLERID(num)=\${${valueVar}}))`);
                    }
                }
                else if (callerId?.mode === 'pool') {
                    dialLines.push('Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})');
                    dialLines.push(...(0, dialplan_trunk_carousel_util_1.emitPoolCallerIdApps)(Array.isArray(callerId.numbers) ? callerId.numbers.map(String) : [], callerId.pick === 'round_robin' ? 'round_robin' : 'random', `krs/cid/${vpbxUserUid}/${this.sanitizeDialplanInput(params.trunk) || 'trunk'}`));
                }
                else {
                    const cid = this.sanitizeDialplanInput(callerId?.mode === 'static' ? callerId.value : params.callerid);
                    if (cid)
                        dialLines.push(`Set(CALLERID(num)=${cid})`);
                }
                if (wh.custom?.url) {
                    dialLines.push(`ExecIf($["\${DIALTO}" != ""]?Dial(${trunk}/\${DIALTO},15,${dialOpts}))`);
                    dialLines.push(`ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return())`);
                }
                dialLines.push(gateSkip(destLookup.skip, destLookup.canExecuteExpr, (0, dialplan_number_util_1.wrapIfRewriteOk)(compiled.usedRewrite, `Dial(${trunk}/${dest},${timeout},${dialOpts})`)));
                dp = [...prelude, ...compiled.lines, ...dialLines].join('\nsame => n,');
                break;
            }
            case 'toexten': {
                const timeout = parseInt(params.timeout, 10) || 30;
                const dialOpts = this.buildDialOptions(params.options || 'tThH', wh);
                const webrtc = params.webrtc !== false && params.webrtc !== 'false';
                const hasTarget = !!(params.target && typeof params.target === 'object')
                    || !!params.useExten
                    || !!(typeof params.exten === 'string' && params.exten);
                if (!hasTarget) {
                    dp = 'NoOp(Missing toexten target)';
                    break;
                }
                const src = (0, dialplan_target_util_1.resolveValueSource)(params, 'target', { stringField: 'exten', useExtenField: 'useExten' });
                const destLookup = compileDirectorySrc(src, (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'TE'), vpbxUserUid);
                const prelude = [...destLookup.lines];
                let dialTarget;
                let compiled = (0, dialplan_number_util_1.compileDialTargetRewrite)('', undefined, 'exten');
                if (src.source === 'fixed' && this.sanitizeDialplanInput(src.value).includes('/')) {
                    dialTarget = this.sanitizeDialplanInput(src.value);
                }
                else {
                    compiled = (0, dialplan_number_util_1.compileDialTargetRewrite)((0, dialplan_number_util_1.sourceExprFromValueSource)(src, destLookup.valueVar) || '${EXTEN}', (0, dialplan_number_util_1.rewriteFromParams)(params), 'exten');
                    if (compiled.usedRewrite) {
                        dialTarget = (0, dialplan_target_util_1.normalizeTarget)('exten', { source: 'variable', name: 'KRSK_DIAL_NUM' }, vpbxUserUid, { webrtc });
                    }
                    else if (src.source === 'fixed') {
                        const manipulated = (0, dialplan_number_util_1.applyNumberManipulation)(this.sanitizeDialplanInput(src.value), params.numberManipulation);
                        if (!manipulated) {
                            dp = 'NoOp(Missing toexten target)';
                            break;
                        }
                        dialTarget = (0, dialplan_target_util_1.normalizeTarget)('exten', { source: 'fixed', value: manipulated }, vpbxUserUid, { webrtc });
                    }
                    else {
                        dialTarget = (0, dialplan_target_util_1.normalizeTarget)('exten', src, vpbxUserUid, { webrtc, directoryValueVar: destLookup.valueVar });
                    }
                }
                const dialLines = [];
                if (wh.custom?.url) {
                    const dialToTarget = this.pjsipDialTarget('${DIALTO}', vpbxUserUid, { webrtc: true });
                    dialLines.push(`ExecIf($["\${DIALTO}" != ""]?Dial(${dialToTarget},15,${dialOpts}))`);
                    dialLines.push(`ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return())`);
                }
                dialLines.push(gateSkip(destLookup.skip, destLookup.canExecuteExpr, (0, dialplan_number_util_1.wrapIfRewriteOk)(compiled.usedRewrite, `Dial(${dialTarget},${timeout},${dialOpts})`)));
                dp = [...prelude, ...compiled.lines, ...dialLines].join('\nsame => n,');
                break;
            }
            case 'toqueue': {
                const src = (0, dialplan_target_util_1.resolveQueueValueSource)(params);
                const timeout = params.timeout ? parseInt(params.timeout, 10) : '';
                const options = this.sanitizeDialplanInput(params.options) || 'thH';
                const announce = this.sanitizeFilePath(String(params.announceoverride ?? ''));
                const destLookup = compileDirectorySrc(src, (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'TQ'), vpbxUserUid);
                const prioSrc = (0, dialplan_target_util_1.resolveQueuePriority)(params);
                const prioLookup = prioSrc?.source === 'directory'
                    ? compileDirectorySrc(prioSrc, (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'TQP'), vpbxUserUid)
                    : { lines: [], valueVar: undefined };
                const prioExpr = prioSrc ? (0, dialplan_target_util_1.queuePriorityExpr)(prioSrc, prioLookup.valueVar) : undefined;
                // Queue on_answer: Asterisk docs confirm gosub runs on the AGENT's channel, not caller's.
                // Variable bridging from caller → agent channel is limited.
                // on_answer for Queue is handled by AMI AgentConnect event in ami.service.ts.
                // We still pass gosub param to capture MEMBERINTERFACE for the AMI handler to correlate.
                // Queue(name,options,URL,announceoverride,timeout,AGI,gosub,...)
                // D-32: QUEUE_PRIO must be set BEFORE Queue() or it has no effect.
                const queue = (0, dialplan_target_util_1.normalizeTarget)('queue', src, vpbxUserUid, { directoryValueVar: destLookup.valueVar });
                const lines = [...destLookup.lines, ...prioLookup.lines];
                if (prioExpr !== undefined)
                    lines.push(`Set(QUEUE_PRIO=${prioExpr})`);
                const queueApp = `Queue(${queue},${options},,${announce},${timeout})`;
                const policy = (wh?.callback_policy ?? this.callbackPolicy);
                const hooks = (0, queue_dialplan_util_1.emitQueueCallbackDialplan)({
                    policy,
                    queueName: queue,
                    queueUid: Number(wh?.callback_queue_uid) || undefined,
                    vpbxUserUid,
                    hasCallbackStep: wh?.has_callback_step === true || this.hasCallbackStep,
                    window_start: wh?.callback_window_start,
                    window_end: wh?.callback_window_end,
                    max_attempts: wh?.callback_max_attempts,
                    pause_minutes: wh?.callback_pause_minutes,
                });
                lines.push(gateSkip(destLookup.skip, destLookup.canExecuteExpr, (0, queue_dialplan_util_1.wrapQueueWithCallbackHooks)(queueApp, { ...hooks, extraContexts: '' })));
                dp = `${lines.join('\nsame => n,')}${hooks.extraContexts}`;
                break;
            }
            case 'toivr': {
                const ivrUid = parseInt(params.ivr_uid, 10);
                dp = ivrUid
                    ? (0, dialplan_hops_util_1.emitHopPrologue)(`ivr_${ivrUid},start,1`, { routeId: `ivr_${ivrUid}` })
                    : `NoOp(Missing IVR UID)`;
                break;
            }
            case 'togroup': {
                const src = (0, dialplan_target_util_1.resolveValueSource)(params, 'target', { stringField: 'group' });
                const destLookup = compileDirectorySrc(src, (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'TG'), vpbxUserUid);
                const gosub = `Gosub(${(0, dialplan_target_util_1.normalizeTarget)('group', src, vpbxUserUid, { directoryValueVar: destLookup.valueVar })},start,1)`;
                dp = [...destLookup.lines, gateSkip(destLookup.skip, destLookup.canExecuteExpr, gosub)].join('\nsame => n,');
                break;
            }
            case 'voicerobot': {
                const robotUid = parseInt(params.robot_uid, 10);
                dp = robotUid
                    ? `Stasis(${(0, ari_app_name_1.resolveAriAppName)()},${robotUid})`
                    : `NoOp(Missing Robot UID)`;
                break;
            }
            case 'ai_voice_robot': {
                const deploymentId = this.sanitizeDialplanInput(String(params.deployment_id || ''));
                dp = deploymentId
                    ? `Stasis(${(0, ari_event_classifier_1.resolveAiVoiceAriAppName)()},${deploymentId})`
                    : `NoOp(Missing AI Voice deployment)`;
                break;
            }
            case 'tolist': {
                const rewrite = (0, dialplan_number_util_1.rewriteFromParams)(params);
                const rawNumbers = (params.numbers || '').split(',')
                    .map((n) => this.sanitizeDialplanInput(n.trim()))
                    .filter(Boolean);
                const rewritten = [];
                let listInvalid = false;
                for (const n of rawNumbers) {
                    if (!rewrite) {
                        rewritten.push(n);
                        continue;
                    }
                    const ev = (0, shared_1.evaluateDialTargetRewrite)(n, rewrite, 'exten');
                    if (ev.error) {
                        listInvalid = true;
                        break;
                    }
                    rewritten.push(ev.output);
                }
                if (listInvalid) {
                    dp = 'NoOp(Invalid rewritten dest)';
                    break;
                }
                const numbers = rewritten.map((n) => `LOCAL/${n}@ctx-${vpbxUserUid}`).join('&');
                const timeout = parseInt(params.timeout, 10) || 30;
                const dialOpts = this.buildDialOptions(params.options || 'tT', wh);
                dp = numbers
                    ? `Dial(${numbers},${timeout},${dialOpts})`
                    : `NoOp(Empty dial list)`;
                break;
            }
            case 'toroute': {
                const ctx = (0, dialplan_target_util_1.normalizeTarget)('context', { source: 'fixed', value: this.sanitizeDialplanInput(params.context) || 'sip-in' }, vpbxUserUid);
                const destSrc = (0, dialplan_target_util_1.resolveValueSource)(params, 'extension');
                const destLookup = compileDirectorySrc(destSrc, (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'TR'), vpbxUserUid);
                const prelude = [...destLookup.lines];
                const compiled = (0, dialplan_number_util_1.compileDialTargetRewrite)((0, dialplan_number_util_1.sourceExprFromValueSource)(destSrc, destLookup.valueVar) || '${EXTEN}', (0, dialplan_number_util_1.rewriteFromParams)(params), 'exten');
                const dest = compiled.destExpr || '${EXTEN}';
                const hop = (0, dialplan_hops_util_1.emitHopPrologue)(`${ctx},${dest},1`, { routeId: ctx });
                const rewriteGate = compiled.usedRewrite
                    ? `ExecIf($["\${${dialplan_number_util_1.DIAL_OK_VAR}}" = "1"]?${hop.split('\nsame => n,')[0]})`
                    : hop.split('\nsame => n,')[0];
                const gate = gateSkip(destLookup.skip, destLookup.canExecuteExpr, rewriteGate);
                const rest = hop.split('\nsame => n,').slice(1);
                dp = [...prelude, ...compiled.lines, gate, ...rest].join('\nsame => n,');
                break;
            }
            case 'playback':
                dp = (0, dialplan_playback_util_1.emitPlayback)(params, { vpbxUserUid });
                break;
            case 'voicemail': {
                dp = this.emitVoicemailDialplan(params, vpbxUserUid);
                break;
            }
            case 'text2speech': {
                const curl = (0, dialplan_curl_util_1.buildCurlCall)('tts', {
                    text: this.sanitizeDialplanInput(params.text),
                    engine: this.sanitizeDialplanInput(String(params.engine ?? '')),
                    ...this.ttsSettingsQuery(params.settings),
                }, this.curlCtx(vpbxUserUid));
                const play = (0, dialplan_playback_util_1.emitPlayback)({ mode: 'plain', files: `\${${shared_1.HTTP_RESULT_VAR}}` }, { vpbxUserUid });
                dp = `${curl}\nsame => n,${play}`;
                break;
            }
            case 'webhook':
                dp = (0, dialplan_curl_util_1.buildCurlCall)('webhook', {
                    url: String(params.url ?? '').replace(/[\n\r"'\\]/g, ''),
                    clid: '${CALLERID(num)}',
                    exten: '${EXTEN}',
                    uniqueid: '${UNIQUEID}',
                }, this.curlCtx(vpbxUserUid));
                break;
            case 'confbridge': {
                const roomSrc = (0, dialplan_target_util_1.resolveValueSource)(params, 'room');
                const destLookup = compileDirectorySrc(roomSrc, (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'CB'), vpbxUserUid);
                if (roomSrc.source === 'fixed') {
                    const uid = String(roomSrc.value ?? '').replace(/\D/g, '');
                    dp = uid
                        ? (0, dialplan_hops_util_1.emitHopPrologue)(`${(0, conference_dialplan_util_1.conferenceRoomContextName)(Number(uid))},s,1`, { routeId: `conf_${uid}` })
                        : 'NoOp(Missing conference room)';
                    break;
                }
                const expr = (0, dialplan_number_util_1.sourceExprFromValueSource)(roomSrc, destLookup.valueVar);
                if (!expr) {
                    dp = [...destLookup.lines, 'NoOp(Missing conference room)'].join('\nsame => n,');
                    break;
                }
                const hop = (0, dialplan_hops_util_1.emitHopPrologue)(`${(0, conference_dialplan_util_1.conferenceMaskContextName)(vpbxUserUid)},${expr},1`, { routeId: `conf_mask_${vpbxUserUid}` });
                const hopLines = hop.split('\nsame => n,');
                dp = [
                    ...destLookup.lines,
                    gateSkip(destLookup.skip, destLookup.canExecuteExpr, hopLines[0]),
                    ...hopLines.slice(1),
                ].join('\nsame => n,');
                break;
            }
            case 'cmd':
                if (!isAdmin) {
                    dp = `NoOp(Unauthorized cmd action)`;
                }
                else {
                    const cleanCmd = (params.command || '').replace(/[\n\r]/g, '');
                    dp = `${cleanCmd || 'NoOp()'}`;
                    logCmdApply(action, vpbxUserUid);
                }
                break;
            case 'label': {
                const name = this.sanitizeDialplanInput(params.label_name);
                dp = name ? `NoOp(${name})` : 'NoOp()';
                break;
            }
            case 'goto': {
                const name = this.sanitizeDialplanInput(params.label_name);
                const expr = params.condition ? (0, dialplan_condition_util_1.buildConditionExpr)(params.condition) : '';
                if (!expr) {
                    dp = (0, dialplan_hops_util_1.emitHopPrologue)(name || 'invalid');
                    break;
                }
                const elseLabel = this.sanitizeDialplanInput(params.false_label);
                dp = [
                    (0, dialplan_hops_util_1.emitHopIncrement)(),
                    (0, dialplan_hops_util_1.emitHopGuard)('Congestion()'),
                    elseLabel
                        ? `GotoIf($[${expr}]?${name || 'invalid'}:${elseLabel})`
                        : `GotoIf($[${expr}]?${name || 'invalid'})`,
                ].join('\nsame => n,');
                break;
            }
            case 'schedule': {
                const intervals = Array.isArray(params.intervals) ? params.intervals : [];
                const lines = ['Set(__KRSK_SCHEDULE=0)'];
                for (const interval of intervals) {
                    const expr = formatTimeGroupInterval(interval);
                    lines.push(`ExecIfTime(${expr}?Set(__KRSK_SCHEDULE=1))`);
                }
                dp = lines.join('\nsame => n,');
                break;
            }
            case 'http_request':
                try {
                    dp = (0, dialplan_http_util_1.emitHttpRequest)(params, {
                        curlCtx: this.curlCtx(vpbxUserUid),
                        actionId: typeof action?.id === 'string' ? action.id : undefined,
                    });
                }
                catch {
                    dp = 'NoOp(Invalid HTTP URL)';
                }
                break;
            case 'collect_input': {
                const variable = this.sanitizeDialplanInput(params.variableName);
                const digits = parseInt(params.digitsCount, 10);
                const timeout = parseInt(params.timeout, 10) || 5;
                const attempts = parseInt(params.attempts, 10) || 1;
                const prompt = this.sanitizeFilePath(params.promptFile);
                if (params.mode === 'extension') {
                    dp = [`WaitExten(${timeout})`, `Set(${variable}=\${EXTEN})`].join('\nsame => n,');
                }
                else {
                    dp = `Read(${variable},${prompt},${digits || 1},,${attempts},${timeout})`;
                }
                break;
            }
            case 'notify':
                dp = this.emitNotifyDialplan(params, vpbxUserUid);
                break;
            case 'callerid': {
                // D-14: unified CallerID — static / directory / setclid_list / carousel
                const mode = params.mode || 'static';
                if (mode === 'static') {
                    const callerid = this.sanitizeDialplanInput(params.callerid);
                    const name = this.sanitizeDialplanInput(params.name);
                    const lines = [`Set(CALLERID(num)=${callerid})`];
                    if (name)
                        lines.push(`Set(CALLERID(name)=${name})`);
                    dp = lines.join('\nsame => n,');
                }
                else if (mode === 'directory') {
                    const fieldUid = Number(params.valueFieldUid);
                    const keySource = params.keySource && typeof params.keySource === 'object'
                        ? params.keySource
                        : { source: 'original_caller' };
                    const onMissing = params.onMissing === 'empty'
                        ? 'empty'
                        : params.onMissing === 'skip'
                            ? 'skip'
                            : 'keep';
                    const compiled = (0, directory_lookup_dialplan_util_1.compileDirectoryLookup)({
                        token: (0, directory_lookup_dialplan_util_1.lookupToken)(action.id ?? action.uid, 'CID'),
                        directoryUid: Number(params.directoryUid),
                        userUid: vpbxUserUid,
                        keySource,
                        fieldUids: [fieldUid],
                        onMissing,
                        backendBaseUrl: this.backendBaseUrl,
                        apiKey: this.dialplanApiKey,
                    });
                    const valueVar = compiled.valueVars.get(fieldUid);
                    const lines = [...compiled.lines];
                    if (onMissing === 'empty') {
                        lines.push('Set(CALLERID(num)=)');
                    }
                    if (valueVar) {
                        lines.push(`ExecIf($["\${${compiled.statusVar}}" = "FOUND" & "\${${valueVar}}" != ""]?Set(CALLERID(num)=\${${valueVar}}))`);
                    }
                    dp = lines.join('\nsame => n,');
                }
                else if (mode === 'number_list') {
                    const listUid = this.sanitizeDialplanInput(String(params.list_uid || ''));
                    dp = this.emitSetclidCurl(listUid, vpbxUserUid);
                }
                else if (mode === 'carousel') {
                    const pool = (Array.isArray(params.pool) ? params.pool : [])
                        .map((c) => this.sanitizeDialplanInput(c))
                        .filter(Boolean);
                    if (!pool.length) {
                        dp = `NoOp(Empty CID carousel pool)`;
                    }
                    else {
                        const lines = pool.map((cid, i) => i === 0
                            ? `Set(CID_1=${cid})`
                            : `Set(CID_${i + 1}=${cid})`);
                        // D-37: skip the same CID twice in a row (CID_LAST from the previous pick).
                        lines.push(`Set(CID_PICK=\${RAND(1,${pool.length})})`);
                        lines.push(`ExecIf($["\${CID_\${CID_PICK}}" = "\${CID_LAST}"]?Set(CID_PICK=$[\${CID_PICK} % ${pool.length} + 1]))`);
                        lines.push(`Set(CALLERID(num)=\${CID_\${CID_PICK}})`);
                        lines.push(`Set(__CID_LAST=\${CALLERID(num)})`);
                        dp = lines.join('\nsame => n,');
                    }
                }
                else {
                    dp = `NoOp(Unknown callerid mode)`;
                }
                break;
            }
            case 'directory_lookup': {
                const keySource = params.keySource && typeof params.keySource === 'object'
                    ? params.keySource
                    : { source: 'original_caller' };
                const outputs = Array.isArray(params.outputs) ? params.outputs : [];
                const compiled = (0, directory_lookup_dialplan_util_1.compileDirectoryLookup)({
                    token: (0, directory_lookup_dialplan_util_1.sanitizeLookupToken)(String(action.id ?? action.uid ?? 'DL')),
                    directoryUid: Number(params.directoryUid),
                    userUid: vpbxUserUid,
                    keySource,
                    fieldUids: outputs.map((output) => Number(output.fieldUid)),
                    outputs,
                    onMissing: params.onMissing === 'empty' ? 'empty' : 'keep',
                    backendBaseUrl: this.backendBaseUrl,
                    apiKey: this.dialplanApiKey,
                });
                dp = compiled.lines.join('\nsame => n,');
                break;
            }
            case 'hangup': {
                const signal = params.signal === 'busy' || params.signal === 'congestion'
                    ? params.signal
                    : 'hangup';
                if (signal === 'hangup') {
                    const causecode = this.sanitizeDialplanInput(params.causecode);
                    dp = causecode ? `Hangup(${causecode})` : 'Hangup()';
                    break;
                }
                const app = signal === 'busy' ? 'Busy' : 'Congestion';
                const timeout = parseInt(params.timeout, 10);
                dp = timeout ? `${app}(${timeout})` : `${app}()`;
                break;
            }
            case 'callback': {
                dp = this.emitCallbackEnqueue(action, params, vpbxUserUid);
                break;
            }
            default:
                dp = `NoOp(Unknown action: ${this.sanitizeDialplanInput(type)})`;
        }
        // D-43: condition wraps every line; branches must not concatenate ExecIf themselves.
        // Extra `[context]` sections (voicemail hangup handler) stay unwrapped.
        return wrapStepKeepExtraContext((0, dialplan_condition_util_1.buildConditionExpr)(action.condition), dp);
    }
    static curlCtx(vpbxUserUid, extra = {}) {
        return {
            baseUrl: this.backendBaseUrl,
            apiKey: this.dialplanApiKey,
            vpbxUserUid,
            ...extra,
        };
    }
    /**
     * D-38 / D-41: enqueue a callback request via authenticated internal CURL.
     * Scanner owns retries — dialplan does not loop.
     */
    static emitCallbackEnqueue(action, params, vpbxUserUid) {
        const windowStart = this.sanitizeDialplanInput(String(params.window_start ?? '09:00'));
        const windowEnd = this.sanitizeDialplanInput(String(params.window_end ?? '21:00'));
        const maxAttempts = parseInt(String(params.max_attempts ?? 3), 10);
        const pauseMinutes = parseInt(String(params.pause_minutes ?? 30), 10);
        const stepId = this.sanitizeDialplanInput(String(action?.id ?? ''));
        return (0, dialplan_curl_util_1.buildCurlCall)('enqueue', {
            caller: '${CALLERID(num)}',
            uniqueid: '${UNIQUEID}',
            route_uid: '${HH_ROUTE_UID}',
            step_id: stepId,
            source: 'route_step',
            window_start: windowStart || '09:00',
            window_end: windowEnd || '21:00',
            max_attempts: String(Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3),
            pause_minutes: String(Number.isFinite(pauseMinutes) && pauseMinutes > 0 ? pauseMinutes : 30),
        }, this.curlCtx(vpbxUserUid, { endpoint: 'internal/callback-requests/enqueue' }));
    }
    static voicemailRecordsBase() {
        const raw = this.recordsBasePath || process.env.RECORDS_BASE_PATH || '/usr/records';
        const trimmed = raw.replace(/\/+$/, '');
        return this.sanitizeDialplanInput(trimmed) || '/usr/records';
    }
    /**
     * D-54 / D-55 / D-72: greeting → hangup_handler_push → Record(.wav,k) →
     * hangup_handler_pop → Goto(done). Handler context ends with fire-and-forget
     * CURL + Return(). Deprecated exten/target are still read (dual-read).
     */
    static emitVoicemailDialplan(params, vpbxUserUid) {
        // D-54: keep deprecated exten / target reads until 13-11 migrate.
        const legacyExten = this.sanitizeDialplanInput(typeof params.exten === 'string' ? params.exten : '');
        if (params.target && typeof params.target === 'object') {
            void params.target;
        }
        else if (typeof params.target === 'string') {
            void this.sanitizeDialplanInput(params.target);
        }
        void legacyExten;
        const doneCtx = `krsk-vm-done-${vpbxUserUid}`;
        const recordPath = `${this.voicemailRecordsBase()}/${vpbxUserUid}/voicemail/\${UNIQUEID}-%d.wav`;
        const maxRaw = Number(params.max_duration);
        const maxDuration = Number.isFinite(maxRaw) && maxRaw > 0 ? String(Math.trunc(maxRaw)) : '120';
        const silenceRaw = params.silence_timeout;
        const silence = silenceRaw == null || silenceRaw === ''
            ? ''
            : String(parseInt(String(silenceRaw), 10) || '');
        const flagKeys = ['q', 'o', 'x', 'y', 'n', 's', 'u'];
        const opts = params.record_options && typeof params.record_options === 'object'
            ? params.record_options
            : {};
        const userFlags = flagKeys.filter((flag) => opts[flag]).join('');
        const recordOpts = `k${userFlags}`;
        const lines = [];
        const greeting = typeof params.greeting === 'string' ? params.greeting.trim() : '';
        if (greeting) {
            lines.push((0, dialplan_playback_util_1.emitPlayback)({ mode: 'plain', files: greeting }, { vpbxUserUid }));
        }
        lines.push(`Set(CHANNEL(hangup_handler_push)=${doneCtx},s,1)`);
        lines.push(`Record(${recordPath},${silence},${maxDuration},${recordOpts})`);
        lines.push('Set(CHANNEL(hangup_handler_pop)=)');
        lines.push(`Goto(${doneCtx},s,1)`);
        const curlPayload = {
            uniqueid: '${UNIQUEID}',
            file: '${RECORDED_FILE}',
            status: '${RECORD_STATUS}',
            clid: '${CALLERID(num)}',
            exten: '${EXTEN}',
        };
        const notify = params.notify && typeof params.notify === 'object' && !Array.isArray(params.notify)
            ? params.notify
            : {};
        if (notify.integration_uid) {
            curlPayload.integration_uid = this.sanitizeDialplanInput(String(notify.integration_uid));
        }
        if (notify.body)
            curlPayload.body = this.sanitizeDialplanInput(String(notify.body));
        if (notify.target)
            curlPayload.target = this.sanitizeDialplanInput(String(notify.target));
        if (notify.subject)
            curlPayload.subject = this.sanitizeDialplanInput(String(notify.subject));
        if (params.stt_engine_uid) {
            curlPayload.stt_engine_uid = this.sanitizeDialplanInput(String(params.stt_engine_uid));
        }
        if (params.llm_provider_uid) {
            curlPayload.llm_provider_uid = this.sanitizeDialplanInput(String(params.llm_provider_uid));
        }
        const curl = (0, dialplan_curl_util_1.buildCurlCall)('voicemail', curlPayload, this.curlCtx(vpbxUserUid));
        const extra = [
            `[${doneCtx}]`,
            `exten => s,1,${curl}`,
            'same => n,Return()',
        ].join('\n');
        return `${lines.join('\nsame => n,')}\n${extra}`;
    }
    /**
     * The channel is owned by the integration, so the step sends only the
     * integration uid, the text and an optional recipient override.
     */
    static emitNotifyDialplan(params, vpbxUserUid) {
        const message = this.sanitizeTemplate(params.body ?? '');
        const subject = this.sanitizeTemplate(params.subject ?? '');
        const target = this.sanitizeTemplate(params.target ?? '');
        const payload = {
            message: '${KNOTIFY_MSG}',
            target: '${KNOTIFY_TARGET}',
            subject: '${KNOTIFY_SUBJ}',
            clid: '${CALLERID(num)}',
            exten: '${EXTEN}',
            uniqueid: '${UNIQUEID}',
        };
        if (params.integration_uid) {
            payload.integration_uid = this.sanitizeDialplanInput(String(params.integration_uid));
        }
        const curl = (0, dialplan_curl_util_1.buildCurlCall)('notify', payload, this.curlCtx(vpbxUserUid));
        return [
            `Set(__KNOTIFY_MSG=${message})`,
            `Set(__KNOTIFY_TARGET=${target})`,
            `Set(__KNOTIFY_SUBJ=${subject})`,
            curl,
        ].join('\nsame => n,');
    }
    /**
     * Flatten per-step TTS overrides into CURL query params. Keys match
     * IIvrPhraseTtsSettings so the bridge can pass them to mergePhraseSettings
     * untouched.
     */
    static ttsSettingsQuery(settings) {
        if (!settings || typeof settings !== 'object' || Array.isArray(settings))
            return {};
        const allowed = ['voice', 'language_code', 'speed', 'speaking_rate', 'role', 'pitch_shift'];
        const out = {};
        for (const key of allowed) {
            const raw = settings[key];
            if (raw == null || raw === '')
                continue;
            out[key] = this.sanitizeDialplanInput(String(raw));
        }
        return out;
    }
    static emitSetclidCurl(listUid, vpbxUserUid) {
        const curl = (0, dialplan_curl_util_1.buildCurlCall)('setclid', {
            list_uid: listUid,
            clidnum: '${CLIDNUM}',
        }, this.curlCtx(vpbxUserUid));
        return `${curl}\nsame => n,ExecIf($["\${${shared_1.HTTP_RESULT_VAR}}" != ""]?Set(CALLERID(num)=\${${shared_1.HTTP_RESULT_VAR}}))`;
    }
    /**
     * Build Dial() options string, injecting U(krsk-on-answer,s,1(dial)) when on_answer webhook is set.
     *
     * The subroutine runs on the CALLER channel immediately when the called party answers,
     * giving access to all caller-side variables: CALLERID(num), UNIQUEID, __HH_ROUTE_UID, etc.
     *
     * @see https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Dialplan_Applications/Dial — U() option
     */
    static buildDialOptions(baseOptions, wh) {
        const sanitized = this.sanitizeDialplanInput(baseOptions);
        if (!wh.on_answer?.url)
            return sanitized;
        // Strip any existing U() from user-supplied options to prevent duplicates
        const stripped = sanitized.replace(/U\([^)]*\)/g, '');
        return `${stripped}U(krsk-on-answer,s,1(dial))`;
    }
}
exports.AsteriskDialplanUtils = AsteriskDialplanUtils;
/**
 * D-53: digit-exit is a control transfer, not linear continuation.
 * Emits GotoIf only — never an unconditional Goto to the same dest.
 */
function emitDigitExitTransition(digit, dest) {
    const safeDigit = String(digit ?? '').replace(/[^0-9*#A-D]/g, '');
    const safeDest = String(dest ?? '').replace(/[?\[\]{}$\\";\n\r]/g, '').trim();
    return `GotoIf($["\${EXTEN}" = "${safeDigit}"]?${safeDest})`;
}
/**
 * D-53 / D-24: indices after the first `terminal === 'always'` step.
 * `conditional` (digit-exit playback) does NOT cut reachability.
 */
function findUnreachableSteps(actions) {
    const cut = actions.findIndex((action) => {
        const meta = shared_1.DIALPLAN_ACTION_META[action.type];
        return meta?.terminal === 'always';
    });
    if (cut === -1)
        return [];
    return actions.map((_, i) => i).filter((i) => i > cut);
}
/**
 * Shared time_group / schedule interval → ExecIfTime / GotoIfTime expression
 * (time,dow,dom,months). Used by route time-group guards and the schedule action.
 */
function formatTimeGroupInterval(interval) {
    const timeExpr = `${interval.time_start}-${interval.time_end}`;
    return `${timeExpr},${interval.days_of_week},${interval.days_of_month},${interval.months}`;
}
/** Prefix a generated application so a leading `(name),` becomes `n(name)`. */
function prefixSamePriority(application) {
    return application.startsWith('(') ? `same => n${application}` : `same => n,${application}`;
}
function joinDialplanParts(parts) {
    return parts.map((part, i) => (i === 0 ? part : prefixSamePriority(part))).join('\n');
}
/** Wrap step lines only; leave appended `[context]` sections (D-55 handler) intact. */
function wrapStepKeepExtraContext(expr, dp) {
    const extraIdx = dp.indexOf('\n[');
    if (extraIdx < 0)
        return (0, dialplan_condition_util_1.wrapEachLine)(expr, dp);
    return `${(0, dialplan_condition_util_1.wrapEachLine)(expr, dp.slice(0, extraIdx))}${dp.slice(extraIdx)}`;
}
/**
 * D-42: single production path for action chains.
 * Order is fixed: step condition (inner, via actionToDialplan) then time-group (outer).
 */
function renderActionChain(actions, ctx) {
    const parts = [];
    for (const action of actions ?? []) {
        let dp = AsteriskDialplanUtils.actionToDialplan(action, ctx.vpbxUserUid, ctx.isAdmin ?? false, ctx.wh ?? {});
        if (!dp)
            continue;
        const tgExpr = ctx.timeGroup
            ?? (typeof action?.condition?.time_group_uid === 'number'
                ? `"\${WT_${action.condition.time_group_uid}}"="1"`
                : '');
        if (tgExpr)
            dp = wrapStepKeepExtraContext(tgExpr, dp);
        if (action?.type === 'label') {
            const name = AsteriskDialplanUtils.sanitizeDialplanInput(action.params?.label_name);
            if (name)
                dp = `(${name}),${dp}`;
        }
        parts.push(dp);
    }
    return joinDialplanParts(parts);
}
//# sourceMappingURL=dialplan.util.js.map