"use strict";
/**
 * Linear trunk carousel (D-36).
 * One loop entry, channel-var index, CUT() over materialized lists.
 * Attempt order for random_then_failover matches the 12-01 wrap-around baseline.
 * Directory CallerID is prefetched once per directory, keyed by original caller.
 * Pool CallerID uses AstDB so consecutive calls avoid the same number.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCarouselMode = resolveCarouselMode;
exports.emitPoolCallerIdApps = emitPoolCallerIdApps;
exports.buildTrunkCarousel = buildTrunkCarousel;
exports.mapTrunkCarouselItems = mapTrunkCarouselItems;
const directory_lookup_dialplan_util_1 = require("./directory-lookup-dialplan.util");
const DIALPLAN_UNSAFE = /[(),?\[\]{}$\\";\n\r]/g;
function sanitize(input) {
    if (!input)
        return '';
    return input.replace(DIALPLAN_UNSAFE, '').trim();
}
function sanitizeListField(input) {
    return sanitize(input).replace(/[|;]/g, '');
}
function asEntry(item) {
    return {
        trunkId: item?.trunkId ?? '',
        timeout: item?.timeout,
        callerId: item?.callerId ?? { mode: 'static' },
    };
}
function resolveTimeout(value, fallback) {
    const parsed = parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
/** Read mode from params; never overwrite the incoming value (selector is real). */
function resolveCarouselMode(mode) {
    return mode === 'sequential' ? 'sequential' : 'random_then_failover';
}
function joinDialplan(head, rest) {
    if (!rest.length)
        return head;
    return [head, ...rest.map((part) => `same => ${part}`)].join('\n');
}
function isDirectoryCaller(callerId) {
    return callerId?.mode === 'directory';
}
function isPoolCaller(callerId) {
    return callerId?.mode === 'pool';
}
function cidModeOf(callerId) {
    if (isDirectoryCaller(callerId))
        return 'directory';
    if (isPoolCaller(callerId))
        return 'pool';
    return 'static';
}
function poolNumbers(callerId) {
    if (!isPoolCaller(callerId))
        return [];
    return (Array.isArray(callerId.numbers) ? callerId.numbers : [])
        .map((n) => sanitizeListField(String(n ?? '')))
        .filter(Boolean);
}
function poolPick(callerId) {
    if (!isPoolCaller(callerId))
        return 'random';
    return callerId.pick === 'round_robin' ? 'round_robin' : 'random';
}
function poolDbFamily(vpbxUserUid, trunkId) {
    const safeTrunk = sanitizeListField(trunkId) || 'trunk';
    const uid = Number.isFinite(vpbxUserUid) ? vpbxUserUid : 0;
    return `krs/cid/${uid}/${safeTrunk}`;
}
/**
 * AstDB-backed CID pool pick with anti-repeat across calls.
 * Prefixed apps assume CALLERID was reset to original caller.
 */
function emitPoolCallerIdApps(numbers, pick, dbFamily) {
    const pool = numbers.map(sanitizeListField).filter(Boolean);
    if (!pool.length)
        return [];
    const family = sanitize(dbFamily).replace(/\|/g, '') || 'krs/cid/0/trunk';
    const n = pool.length;
    const apps = [
        `Set(CID_POOL=${pool.join('|')})`,
        `Set(CID_N=${n})`,
        `Set(CID_DBKEY=${family})`,
    ];
    if (pick === 'round_robin') {
        apps.push('Set(CID_I=${DB(${CID_DBKEY}/i)})', 'ExecIf($["${CID_I}" = ""]?Set(CID_I=0))', 'Set(CID_I=$[${CID_I} + 1])', 'ExecIf($[${CID_I} > ${CID_N}]?Set(CID_I=1))', 'Set(DB(${CID_DBKEY}/i)=${CID_I})', 'Set(CALLERID(num)=${CUT(CID_POOL,|,${CID_I})})');
    }
    else {
        apps.push(`Set(CID_PICK=\${RAND(1,${n})})`, 'ExecIf($["${CUT(CID_POOL,|,${CID_PICK})}" = "${DB(${CID_DBKEY}/last)}"]?Set(CID_PICK=$[${CID_PICK} % ${CID_N} + 1]))', 'Set(CALLERID(num)=${CUT(CID_POOL,|,${CID_PICK})})');
    }
    apps.push('Set(DB(${CID_DBKEY}/last)=${CALLERID(num)})');
    return apps;
}
function compileDirectoryGroups(entries, ctx) {
    const fieldsByDirectory = new Map();
    for (const entry of entries) {
        if (!isDirectoryCaller(entry.callerId))
            continue;
        const directoryUid = Number(entry.callerId.directoryUid);
        const fieldUid = Number(entry.callerId.valueFieldUid);
        if (!Number.isInteger(directoryUid) || directoryUid < 1)
            continue;
        const fields = fieldsByDirectory.get(directoryUid) ?? [];
        fields.push(fieldUid);
        fieldsByDirectory.set(directoryUid, fields);
    }
    const compiled = new Map();
    for (const [directoryUid, fieldUids] of fieldsByDirectory) {
        const uniqueSorted = [...new Set(fieldUids)]
            .filter((uid) => Number.isInteger(uid) && uid >= 1)
            .sort((a, b) => a - b);
        compiled.set(directoryUid, (0, directory_lookup_dialplan_util_1.compileDirectoryLookup)({
            token: `TC${directoryUid}`,
            directoryUid,
            userUid: ctx.vpbxUserUid ?? 0,
            keySource: { source: 'original_caller' },
            fieldUids: uniqueSorted,
            onMissing: 'keep',
            backendBaseUrl: ctx.backendBaseUrl || 'http://127.0.0.1:5010/api',
            apiKey: ctx.dialplanApiKey ?? '',
        }));
    }
    return compiled;
}
function directorySlots(callerId, groups) {
    if (!isDirectoryCaller(callerId))
        return { valueVar: '', statusVar: '' };
    const compiled = groups.get(Number(callerId.directoryUid));
    if (!compiled)
        return { valueVar: '', statusVar: '' };
    return {
        valueVar: compiled.valueVars.get(Number(callerId.valueFieldUid)) ?? '',
        statusVar: compiled.statusVar,
    };
}
function emitCallerIdApply(entry, groups, ctx) {
    const callerId = entry.callerId;
    const apps = ['Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})'];
    if (isDirectoryCaller(callerId)) {
        const { valueVar, statusVar } = directorySlots(callerId, groups);
        if (valueVar && statusVar) {
            apps.push(`ExecIf($["\${${statusVar}}" = "FOUND" & "\${${valueVar}}" != ""]?Set(CALLERID(num)=\${${valueVar}}))`);
        }
        return apps;
    }
    if (isPoolCaller(callerId)) {
        apps.push(...emitPoolCallerIdApps(poolNumbers(callerId), poolPick(callerId), poolDbFamily(ctx.vpbxUserUid ?? 0, entry.trunkId)));
        return apps;
    }
    const cid = sanitizeListField(callerId.mode === 'static' ? callerId.value : '');
    if (cid)
        apps.push(`Set(CALLERID(num)=${cid})`);
    return apps;
}
function emitSingleTrunk(entry, ctx) {
    const fallbackTimeout = resolveTimeout(ctx.timeout, 60);
    const timeout = resolveTimeout(entry.timeout, fallbackTimeout);
    const trunkId = sanitizeListField(entry.trunkId);
    const dest = ctx.dest || '${EXTEN}';
    const opts = sanitize(ctx.options || 'tT');
    const groups = compileDirectoryGroups([entry], ctx);
    const apps = [];
    for (const compiled of groups.values()) {
        apps.push(...compiled.lines);
    }
    apps.push(...emitCallerIdApply({ ...entry, trunkId }, groups, ctx));
    apps.push(`Dial(PJSIP/${trunkId}/${dest},${timeout},${opts})`);
    apps.push('Return()');
    return joinDialplan(apps[0], apps.slice(1).map((app) => `n,${app}`));
}
/**
 * Build a linear Dial loop over trunks.
 * Empty list → diagnostic NoOp (next chain step still runs).
 */
function buildTrunkCarousel(trunks, ctx = {}) {
    const entries = (Array.isArray(trunks) ? trunks : []).map(asEntry)
        .map((item) => ({ ...item, trunkId: sanitizeListField(item.trunkId) }))
        .filter((item) => item.trunkId);
    if (!entries.length) {
        return 'NoOp(Empty trunk carousel)';
    }
    if (entries.length === 1) {
        return emitSingleTrunk(entries[0], ctx);
    }
    const mode = resolveCarouselMode(ctx.mode);
    const fallbackTimeout = resolveTimeout(ctx.timeout, 60);
    const dest = ctx.dest || '${EXTEN}';
    const opts = sanitize(ctx.options || 'tT');
    const n = entries.length;
    const groups = compileDirectoryGroups(entries, ctx);
    const vpbx = ctx.vpbxUserUid ?? 0;
    const list = entries.map((e) => e.trunkId).join('|');
    const timeouts = entries.map((e) => String(resolveTimeout(e.timeout, fallbackTimeout))).join('|');
    const cidModes = entries.map((e) => cidModeOf(e.callerId)).join('|');
    const cids = entries.map((e) => (cidModeOf(e.callerId) === 'static'
        ? sanitizeListField(e.callerId.mode === 'static' ? e.callerId.value : '')
        : '')).join('|');
    const cidVars = entries.map((e) => directorySlots(e.callerId, groups).valueVar).join('|');
    const cidStatus = entries.map((e) => directorySlots(e.callerId, groups).statusVar).join('|');
    const pools = entries.map((e) => poolNumbers(e.callerId).join('|')).join(';');
    const picks = entries.map((e) => poolPick(e.callerId)).join('|');
    const start = mode === 'sequential' ? 'Set(TC_I=1)' : `Set(TC_I=\${RAND(1,${n})})`;
    const rest = [];
    for (const compiled of groups.values()) {
        for (const line of compiled.lines) {
            rest.push(`n,${line}`);
        }
    }
    rest.push(`n,Set(TC_TIMEOUTS=${timeouts})`, `n,Set(TC_CIDMODE=${cidModes})`, `n,Set(TC_CID=${cids})`, `n,Set(TC_CIDVAR=${cidVars})`, `n,Set(TC_CIDST=${cidStatus})`, `n,Set(TC_POOLS=${pools})`, `n,Set(TC_PICK=${picks})`, `n,Set(TC_VPBX=${vpbx})`, `n,Set(TC_N=${n})`, `n,${start}`, 'n,Set(TC_TRIED=0)', 'n(tc_try),Set(TC_TRUNK_ID=${CUT(TC_LIST,|,${TC_I})})', 'n,Set(TC_TIMEOUT=${CUT(TC_TIMEOUTS,|,${TC_I})})', 'n,Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})', 'n,Set(TC_CM=${CUT(TC_CIDMODE,|,${TC_I})})', 'n,GotoIf($["${TC_CM}" = "directory"]?tc_dir)', 'n,GotoIf($["${TC_CM}" = "pool"]?tc_pool)', 'n,Set(TC_CIDV=${CUT(TC_CID,|,${TC_I})})', 'n,ExecIf($["${TC_CIDV}" != ""]?Set(CALLERID(num)=${TC_CIDV}))', 'n,Goto(tc_dial)', 'n(tc_dir),Set(TC_VV=${CUT(TC_CIDVAR,|,${TC_I})})', 'n,Set(TC_ST=${CUT(TC_CIDST,|,${TC_I})})', 'n,ExecIf($["${${TC_ST}}" = "FOUND" & "${${TC_VV}}" != ""]?Set(CALLERID(num)=${${TC_VV}}))', 'n,Goto(tc_dial)', 'n(tc_pool),Set(CID_POOL=${CUT(TC_POOLS,;,${TC_I})})', 'n,GotoIf($["${CID_POOL}" = ""]?tc_dial)', 'n,Set(CID_N=${FIELDQTY(CID_POOL,|)})', 'n,GotoIf($[${CID_N} < 1]?tc_dial)', 'n,Set(CID_DBKEY=krs/cid/${TC_VPBX}/${TC_TRUNK_ID})', 'n,Set(TC_PK=${CUT(TC_PICK,|,${TC_I})})', 'n,GotoIf($["${TC_PK}" = "round_robin"]?tc_pool_rr)', 'n,Set(CID_PICK=${RAND(1,${CID_N})})', 'n,ExecIf($["${CUT(CID_POOL,|,${CID_PICK})}" = "${DB(${CID_DBKEY}/last)}"]?Set(CID_PICK=$[${CID_PICK} % ${CID_N} + 1]))', 'n,Set(CALLERID(num)=${CUT(CID_POOL,|,${CID_PICK})})', 'n,Set(DB(${CID_DBKEY}/last)=${CALLERID(num)})', 'n,Goto(tc_dial)', 'n(tc_pool_rr),Set(CID_I=${DB(${CID_DBKEY}/i)})', 'n,ExecIf($["${CID_I}" = ""]?Set(CID_I=0))', 'n,Set(CID_I=$[${CID_I} + 1])', 'n,ExecIf($[${CID_I} > ${CID_N}]?Set(CID_I=1))', 'n,Set(DB(${CID_DBKEY}/i)=${CID_I})', 'n,Set(CALLERID(num)=${CUT(CID_POOL,|,${CID_I})})', 'n,Set(DB(${CID_DBKEY}/last)=${CALLERID(num)})', `n(tc_dial),Dial(PJSIP/\${TC_TRUNK_ID}/${dest},\${TC_TIMEOUT},${opts})`, 'n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())', 'n,Set(TC_I=$[${TC_I} + 1])', 'n,ExecIf($[${TC_I} > ${TC_N}]?Set(TC_I=1))', 'n,Set(TC_TRIED=$[${TC_TRIED} + 1])', 'n,GotoIf($[${TC_TRIED} < ${TC_N}]?tc_try)', 'n,Return()');
    return joinDialplan(`Set(TC_LIST=${list})`, rest);
}
/** Map raw action trunk rows (incl. pool) into ITrunkCarouselItem[]. */
function mapTrunkCarouselItems(trunks) {
    return (Array.isArray(trunks) ? trunks : []).map((item) => {
        const mode = item.callerId?.mode;
        let callerId;
        if (mode === 'directory') {
            callerId = {
                mode: 'directory',
                directoryUid: Number(item.callerId?.directoryUid),
                valueFieldUid: Number(item.callerId?.valueFieldUid),
                keySource: { source: 'original_caller' },
                onMissing: 'keep_original',
            };
        }
        else if (mode === 'pool') {
            callerId = {
                mode: 'pool',
                numbers: Array.isArray(item.callerId?.numbers)
                    ? item.callerId.numbers.map((n) => String(n ?? ''))
                    : [],
                pick: item.callerId?.pick === 'round_robin' ? 'round_robin' : 'random',
            };
        }
        else {
            callerId = { mode: 'static', value: item.callerId?.value };
        }
        return {
            trunkId: String(item.trunkId ?? ''),
            callerId,
            timeout: item.timeout,
        };
    });
}
//# sourceMappingURL=dialplan-trunk-carousel.util.js.map