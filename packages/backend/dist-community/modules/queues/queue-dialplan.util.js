"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeDtmfDigit = sanitizeDtmfDigit;
exports.wantsCallbackDtmf = wantsCallbackDtmf;
exports.wantsCallbackAbandon = wantsCallbackAbandon;
exports.callbackDtmfContextName = callbackDtmfContextName;
exports.callbackAbandonContextName = callbackAbandonContextName;
exports.emitQueueCallbackDialplan = emitQueueCallbackDialplan;
exports.wrapQueueWithCallbackHooks = wrapQueueWithCallbackHooks;
const dialplan_curl_util_1 = require("../../shared/utils/dialplan-curl.util");
const DTMF_RE = /^[0-9*#]$/;
function sanitizeDtmfDigit(value) {
    const raw = String(value ?? '').trim();
    return DTMF_RE.test(raw) ? raw : '1';
}
function wantsCallbackDtmf(policy) {
    return policy?.order_mode === 'subscriber' || policy?.order_mode === 'both';
}
function wantsCallbackAbandon(policy) {
    return policy?.order_mode === 'queue_abandon' || policy?.order_mode === 'both';
}
function callbackDtmfContextName(vpbxUserUid) {
    return `krsk-cb-dtmf-${vpbxUserUid}`;
}
function callbackAbandonContextName(vpbxUserUid) {
    return `krsk-cb-abn-${vpbxUserUid}`;
}
function enqueueCurl(source, opts) {
    const windowStart = String(opts.window_start ?? '09:00');
    const windowEnd = String(opts.window_end ?? '21:00');
    const maxAttempts = Number(opts.max_attempts ?? 3);
    const pauseMinutes = Number(opts.pause_minutes ?? 30);
    return (0, dialplan_curl_util_1.buildCurlCall)('enqueue', {
        caller: '${CALLERID(num)}',
        uniqueid: '${UNIQUEID}',
        route_uid: '${HH_ROUTE_UID}',
        queue_uid: opts.queueUid != null ? String(opts.queueUid) : '',
        queue_name: opts.queueName,
        source,
        window_start: windowStart,
        window_end: windowEnd,
        max_attempts: String(Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3),
        pause_minutes: String(Number.isFinite(pauseMinutes) && pauseMinutes > 0 ? pauseMinutes : 30),
    }, {
        vpbxUserUid: opts.vpbxUserUid,
        endpoint: 'internal/callback-requests/enqueue',
    });
}
/**
 * D-38: DTMF-while-waiting and/or abandon enqueue fragments for Queue().
 * order_mode queue_abandon suppresses the DTMF hook entirely (dtmf_digit ignored).
 */
function emitQueueCallbackDialplan(opts) {
    const empty = {
        waitLines: [],
        extraContexts: '',
        queueContext: null,
    };
    if (!opts.hasCallbackStep || !opts.policy)
        return empty;
    const dtmf = wantsCallbackDtmf(opts.policy);
    const abandon = wantsCallbackAbandon(opts.policy);
    if (!dtmf && !abandon)
        return empty;
    const waitLines = [];
    const contexts = [];
    let queueContext = null;
    if (dtmf) {
        const digit = sanitizeDtmfDigit(opts.policy.dtmf_digit);
        queueContext = callbackDtmfContextName(opts.vpbxUserUid);
        const curl = enqueueCurl('queue_dtmf', opts);
        contexts.push([
            `[${queueContext}]`,
            `exten => ${digit},1,NoOp(callback-dtmf ${opts.queueName})`,
            `same => n,${curl}`,
            'same => n,Hangup()',
            'exten => i,1,WaitExten(8)',
        ].join('\n'));
    }
    if (abandon) {
        const ctx = callbackAbandonContextName(opts.vpbxUserUid);
        const curl = enqueueCurl('queue_abandon', opts);
        waitLines.push(`Set(CHANNEL(hangup_handler_push)=${ctx},s,1)`);
        waitLines.push(`ExecIf($["\${QUEUESTATUS}" = "TIMEOUT"]?Goto(${ctx},s,1))`);
        contexts.push([
            `[${ctx}]`,
            `exten => s,1,NoOp(callback-abandon ${opts.queueName})`,
            `same => n,${curl}`,
            'same => n,Return()',
        ].join('\n'));
    }
    return {
        waitLines,
        extraContexts: contexts.length ? `\n${contexts.join('\n')}` : '',
        queueContext,
    };
}
/** Apply hangup-handler / TIMEOUT lines around an existing Queue() app. */
function wrapQueueWithCallbackHooks(queueApp, hooks) {
    if (!hooks.waitLines.length && !hooks.extraContexts)
        return queueApp;
    const before = hooks.waitLines.filter((line) => line.includes('hangup_handler_push'));
    const after = hooks.waitLines.filter((line) => !line.includes('hangup_handler_push'));
    const parts = [...before, queueApp, ...after];
    return `${parts.join('\nsame => n,')}${hooks.extraContexts}`;
}
//# sourceMappingURL=queue-dialplan.util.js.map