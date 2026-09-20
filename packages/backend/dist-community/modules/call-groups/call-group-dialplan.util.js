"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGroupDialplan = generateGroupDialplan;
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const dialplan_playback_util_1 = require("../../shared/utils/dialplan-playback.util");
const dialplan_options_util_1 = require("../../shared/utils/dialplan-options.util");
const call_group_confirm_util_1 = require("./call-group-confirm.util");
const ANSWER_RETURN = 'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())';
const FINAL_RETURN = 'same => n,Return()';
const TARGETS_VAR = 'KRSK_CG_TARGETS';
const BUSY_STATES = ['BUSY', 'INUSE', 'UNAVAILABLE', 'RINGING', 'ONHOLD'];
function sortMembers(members) {
    return [...members].sort((a, b) => a.position - b.position);
}
function memberInterface(member, vpbx, externalContext, webrtcExtensions) {
    const value = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(member.value);
    if (member.member_type === 'internal') {
        const webrtc = webrtcExtensions?.has(value) === true;
        return dialplan_util_1.AsteriskDialplanUtils.pjsipDialTarget(value, vpbx, { webrtc });
    }
    const ctx = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(externalContext);
    return `LOCAL/${value}@${ctx}`;
}
/** Tenant-scoped PJSIP endpoint used as DEVICE_STATE() argument (T-12-15-05). */
function deviceStateTarget(member, vpbx) {
    if (member.member_type !== 'internal')
        return null;
    const value = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(member.value);
    return `PJSIP/e${value}_${vpbx}`;
}
function isBusyExpr(device) {
    return BUSY_STATES.map((state) => `"\${DEVICE_STATE(${device})}" = "${state}"`).join(' | ');
}
function skipLabel(device) {
    return `cgsk_${device.replace(/[^A-Za-z0-9]/g, '_')}`;
}
function buildDialLine(targets, ringTime, dialOpts) {
    return `same => n,Dial(${targets},${ringTime},${dialOpts})`;
}
function optsForMembers(base, members, confirm) {
    if (!confirm || !members.some((m) => m.member_type === 'external')) {
        return base;
    }
    return (0, call_group_confirm_util_1.mergeDialOptions)(base, (0, call_group_confirm_util_1.confirmOption)(call_group_confirm_util_1.CALL_GROUP_CONFIRM_MACRO));
}
function emitFilterOnce(lines, members, vpbx, externalContext, webrtcExtensions) {
    lines.push(`same => n,Set(${TARGETS_VAR}=)`);
    for (const member of members) {
        const iface = memberInterface(member, vpbx, externalContext, webrtcExtensions);
        const device = deviceStateTarget(member, vpbx);
        const append = `Set(${TARGETS_VAR}=\${IF($["\${${TARGETS_VAR}}" = ""]?${iface}:\${${TARGETS_VAR}}&${iface})})`;
        if (!device) {
            lines.push(`same => n,${append}`);
            continue;
        }
        const label = skipLabel(device);
        lines.push(`same => n,GotoIf($[${isBusyExpr(device)}]?${label})`);
        lines.push(`same => n,${append}`);
        lines.push(`same => n(${label}),NoOp()`);
    }
}
function emitDialOrAllBusy(lines, ringTime, dialOpts) {
    lines.push(`same => n,GotoIf($["\${${TARGETS_VAR}}" != ""]?cgdial)`);
    lines.push('same => n,NoOp(Call group: all members busy)');
    lines.push('same => n,Goto(cgdone)');
    lines.push(`same => n(cgdial),Dial(\${${TARGETS_VAR}},${ringTime},${dialOpts})`);
    lines.push('same => n(cgdone),NoOp()');
}
/**
 * Prefix install and rollback live in one function so restore cannot be forgotten (D-35 / T-12-14-04).
 */
function cidPrefixOps(group) {
    const prefix = group.cid_prefix
        ? dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(group.cid_prefix)
        : '';
    if (!prefix) {
        return { enter: [], beforeReturn: [], beforeAnswerReturn: [] };
    }
    return {
        enter: [
            'same => n,Set(KRSK_CID_NAME=${CALLERID(name)})',
            `same => n,Set(CALLERID(name)=${prefix} \${CALLERID(name)})`,
        ],
        beforeReturn: ['same => n,Set(CALLERID(name)=${KRSK_CID_NAME})'],
        beforeAnswerReturn: [
            'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Set(CALLERID(name)=${KRSK_CID_NAME}))',
        ],
    };
}
function shuffleCopy(items, rng) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const swap = out[i];
        out[i] = out[j];
        out[j] = swap;
    }
    return out;
}
function emitGreeting(lines, prompt, vpbx) {
    const file = dialplan_util_1.AsteriskDialplanUtils.sanitizeFilePath(prompt);
    if (!file)
        return;
    const playback = (0, dialplan_playback_util_1.emitPlayback)({ mode: 'plain', files: [file] }, { vpbxUserUid: vpbx });
    lines.push(`same => n,${playback}`);
}
function emitPrologue(lines, ctx) {
    const cid = cidPrefixOps(ctx.group);
    lines.push(...cid.enter);
    emitGreeting(lines, ctx.greetingPrompt, ctx.vpbx);
    return cid;
}
function emitRingall(lines, ctx) {
    const cid = emitPrologue(lines, ctx);
    const opts = optsForMembers(ctx.dialOpts, ctx.members, ctx.confirm);
    if (ctx.skipBusy) {
        emitFilterOnce(lines, ctx.members, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions);
        emitDialOrAllBusy(lines, ctx.group.ring_time, opts);
    }
    else {
        const targets = ctx.members
            .map((m) => memberInterface(m, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions))
            .join('&');
        lines.push(buildDialLine(targets, ctx.group.ring_time, opts));
    }
    lines.push(...cid.beforeReturn);
    lines.push(FINAL_RETURN);
}
function emitHunt(lines, ctx) {
    const cid = emitPrologue(lines, ctx);
    for (let i = 0; i < ctx.members.length; i++) {
        const member = ctx.members[i];
        const opts = optsForMembers(ctx.dialOpts, [member], ctx.confirm);
        const iface = memberInterface(member, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions);
        const device = ctx.skipBusy ? deviceStateTarget(member, ctx.vpbx) : null;
        if (device) {
            const label = skipLabel(device) + `_${i}`;
            lines.push(`same => n,GotoIf($[${isBusyExpr(device)}]?${label})`);
            lines.push(buildDialLine(iface, member.ring_time, opts));
            if (i < ctx.members.length - 1) {
                lines.push(...cid.beforeAnswerReturn);
                lines.push(ANSWER_RETURN);
            }
            lines.push(`same => n(${label}),NoOp()`);
        }
        else {
            lines.push(buildDialLine(iface, member.ring_time, opts));
            if (i < ctx.members.length - 1) {
                lines.push(...cid.beforeAnswerReturn);
                lines.push(ANSWER_RETURN);
            }
        }
    }
    if (ctx.skipBusy) {
        lines.push('same => n,NoOp(Call group: all members busy)');
    }
    lines.push(...cid.beforeReturn);
    lines.push(FINAL_RETURN);
}
function emitMemoryhunt(lines, ctx) {
    const cid = emitPrologue(lines, ctx);
    if (ctx.skipBusy) {
        emitFilterOnce(lines, ctx.members, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions);
        emitDialOrAllBusy(lines, ctx.members[ctx.members.length - 1]?.ring_time ?? ctx.group.ring_time, optsForMembers(ctx.dialOpts, ctx.members, ctx.confirm));
        lines.push(...cid.beforeReturn);
        lines.push(FINAL_RETURN);
        return;
    }
    for (let i = 0; i < ctx.members.length; i++) {
        const subset = ctx.members.slice(0, i + 1);
        const targets = subset
            .map((m) => memberInterface(m, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions))
            .join('&');
        lines.push(buildDialLine(targets, ctx.members[i].ring_time, optsForMembers(ctx.dialOpts, subset, ctx.confirm)));
        if (i < ctx.members.length - 1) {
            lines.push(...cid.beforeAnswerReturn);
            lines.push(ANSWER_RETURN);
        }
    }
    lines.push(...cid.beforeReturn);
    lines.push(FINAL_RETURN);
}
function emitRandom(lines, ctx, rng) {
    const shuffled = shuffleCopy(ctx.members, rng);
    const cid = emitPrologue(lines, ctx);
    const first = shuffled[0];
    if (!first) {
        lines.push(...cid.beforeReturn);
        lines.push(FINAL_RETURN);
        return;
    }
    if (ctx.skipBusy) {
        emitFilterOnce(lines, shuffled, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions);
        emitDialOrAllBusy(lines, ctx.group.ring_time, optsForMembers(ctx.dialOpts, shuffled, ctx.confirm));
        lines.push(...cid.beforeReturn);
        lines.push(FINAL_RETURN);
        return;
    }
    lines.push(buildDialLine(memberInterface(first, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions), first.ring_time, optsForMembers(ctx.dialOpts, [first], ctx.confirm)));
    if (shuffled.length > 1) {
        const rest = shuffled.slice(1);
        lines.push(...cid.beforeAnswerReturn);
        lines.push(ANSWER_RETURN);
        const restTargets = rest
            .map((m) => memberInterface(m, ctx.vpbx, ctx.group.external_context, ctx.webrtcExtensions))
            .join('&');
        lines.push(buildDialLine(restTargets, ctx.group.ring_time, optsForMembers(ctx.dialOpts, rest, ctx.confirm)));
    }
    lines.push(...cid.beforeReturn);
    lines.push(FINAL_RETURN);
}
function generateGroupDialplan(group, members, vpbx, webrtcExtensions, options) {
    const rng = options?.rng ?? Math.random.bind(Math);
    const confirm = options?.confirmExternal ?? group.confirmExternal ?? false;
    const confirmDigit = options?.confirmDigit ?? group.confirmDigit;
    const skipBusy = options?.skipBusy ?? group.skipBusy ?? false;
    const greetingPrompt = options?.greetingPrompt ?? group.greetingPrompt;
    const useMoh = options?.useMohInsteadOfRingback ?? group.useMohInsteadOfRingback ?? false;
    const mohClass = dialplan_util_1.AsteriskDialplanUtils.sanitizeFilePath(options?.mohClass ?? group.mohClass);
    const rawOpts = options?.dialOpts ?? group.dialOptions ?? 'tT';
    let dialOpts = (0, call_group_confirm_util_1.stripMohDialTokens)((0, dialplan_options_util_1.serializeOptions)((0, dialplan_options_util_1.parseOptions)(rawOpts)));
    if (useMoh) {
        dialOpts = (0, call_group_confirm_util_1.mergeDialOptions)(dialOpts, mohClass ? `m(${mohClass})` : 'm');
    }
    const ctxName = (0, dialplan_target_util_1.normalizeTarget)('group', { source: 'fixed', value: group.exten }, vpbx);
    const sorted = sortMembers(members);
    const lines = [];
    lines.push(`[${ctxName}]`);
    lines.push(`exten => start,1,NoOp(Call group: ${group.name} [${group.strategy}])`);
    const ctx = {
        group,
        members: sorted,
        vpbx,
        webrtcExtensions,
        dialOpts,
        confirm,
        skipBusy,
        greetingPrompt,
    };
    switch (group.strategy) {
        case 'ringall':
            emitRingall(lines, ctx);
            break;
        case 'hunt':
            emitHunt(lines, ctx);
            break;
        case 'memoryhunt':
            emitMemoryhunt(lines, ctx);
            break;
        case 'random':
            emitRandom(lines, ctx, rng);
            break;
    }
    const extras = [];
    if (confirm && sorted.some((m) => m.member_type === 'external')) {
        extras.push((0, call_group_confirm_util_1.buildConfirmMacro)({ name: call_group_confirm_util_1.CALL_GROUP_CONFIRM_MACRO, digit: confirmDigit }));
    }
    return { name: ctxName, lines, extras };
}
//# sourceMappingURL=call-group-dialplan.util.js.map