"use strict";
/**
 * D-25: inherited hop counter across toroute / toivr.
 * Increment and guard MUST be emitted together (emitHopPrologue) so the
 * counter cannot grow without a check.
 *
 * Double underscore preserves the counter through descendant channels.
 * Goto itself stays on the same channel and does not reset variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HOP_LIMIT = exports.HOPS_VAR = void 0;
exports.resolveHopDecision = resolveHopDecision;
exports.emitHopIncrement = emitHopIncrement;
exports.emitHopGuard = emitHopGuard;
exports.emitHopPrologue = emitHopPrologue;
/** Inherited channel variable — the leading `__` is load-bearing. */
exports.HOPS_VAR = '__KRSK_HOPS';
const HOPS_READ_VAR = 'KRSK_HOPS';
/**
 * Default hop budget. 10 is well above any meaningful IVR/route chain
 * (typically 2–4 hops) and well below the point where Asterisk starts
 * burning CPU on tight Goto loops.
 */
exports.DEFAULT_HOP_LIMIT = 10;
/** Same arithmetic as the emitted dialplan: missing var = 0. */
function resolveHopDecision(incoming, limit = exports.DEFAULT_HOP_LIMIT) {
    const next = (incoming ?? 0) + 1;
    return next > limit ? 'exceed' : 'goto';
}
function emitHopIncrement() {
    // An unset variable expands to an empty operand: "$[ + 1]" is not zero + 1.
    return `Set(${exports.HOPS_VAR}=$[\${IF($["\${${HOPS_READ_VAR}}" = ""]?0:\${${HOPS_READ_VAR}})} + 1])`;
}
function emitHopGuard(onExceed) {
    return [
        `GotoIf($[\${${HOPS_READ_VAR}} <= ${exports.DEFAULT_HOP_LIMIT}]?+3)`,
        `NoOp(KRSK hop limit exceeded)`,
        onExceed,
    ].join('\nsame => n,');
}
function emitHopPrologue(gotoTarget, opts) {
    const onExceed = opts?.onExceed ?? 'Congestion()';
    const routeId = (opts?.routeId ?? gotoTarget).replace(/[(),?\[\]{}$\\";\n\r]/g, '').trim();
    return [
        emitHopIncrement(),
        `GotoIf($[\${${HOPS_READ_VAR}} <= ${exports.DEFAULT_HOP_LIMIT}]?${gotoTarget})`,
        `NoOp(KRSK hop limit exceeded route=${routeId})`,
        onExceed,
    ].join('\nsame => n,');
}
//# sourceMappingURL=dialplan-hops.util.js.map