"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIRM_DIGIT = exports.CALL_GROUP_CONFIRM_VAR = exports.CALL_GROUP_CONFIRM_MACRO = void 0;
exports.normalizeConfirmDigit = normalizeConfirmDigit;
exports.confirmOption = confirmOption;
exports.mergeDialOptions = mergeDialOptions;
exports.stripMohDialTokens = stripMohDialTokens;
exports.buildConfirmMacro = buildConfirmMacro;
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
const dialplan_options_util_1 = require("../../shared/utils/dialplan-options.util");
/** Macro name used by Dial() option M(...) — only for external members (D-34). */
exports.CALL_GROUP_CONFIRM_MACRO = 'krsk-cg-confirm';
/** Channel variable set to 1 when the callee pressed the confirm digit. */
exports.CALL_GROUP_CONFIRM_VAR = 'KRSK_CG_CONFIRMED';
/** Default DTMF key for external answer confirmation. */
exports.DEFAULT_CONFIRM_DIGIT = '1';
const CONFIRM_DIGIT_PATTERN = /^[0-9*#]$/;
/**
 * Single DTMF key (0-9, *, #). Invalid / empty values fall back to {@link DEFAULT_CONFIRM_DIGIT}.
 */
function normalizeConfirmDigit(digit) {
    const raw = String(digit ?? '').trim();
    return CONFIRM_DIGIT_PATTERN.test(raw) ? raw : exports.DEFAULT_CONFIRM_DIGIT;
}
/**
 * External = `member_type === 'external'` — the same flag `memberInterface` uses
 * to emit LOCAL/ rather than PJSIP/. Internals never go through operator VM.
 */
function confirmOption(macroName) {
    const safe = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(macroName) || exports.CALL_GROUP_CONFIRM_MACRO;
    return (0, dialplan_options_util_1.serializeOptions)((0, dialplan_options_util_1.parseOptions)(`M(${safe})`));
}
function mergeDialOptions(base, extra) {
    return (0, dialplan_options_util_1.serializeOptions)({
        tokens: [...(0, dialplan_options_util_1.parseOptions)(base).tokens, ...(0, dialplan_options_util_1.parseOptions)(extra).tokens],
    });
}
/** Remove Dial `m` / `m(...)` tokens — MOH is applied via useMohInsteadOfRingback. */
function stripMohDialTokens(opts) {
    return (0, dialplan_options_util_1.serializeOptions)({
        tokens: (0, dialplan_options_util_1.parseOptions)(opts).tokens.filter((token) => token !== 'm' && !token.startsWith('m(')),
    });
}
/**
 * Asterisk Macro context `[macro-<name>]`. Dial option M(name) runs it on the
 * called channel after answer. Wrong/missing DTMF sets MACRO_RESULT=CONTINUE
 * so Dial() does not treat the leg as answered and the group keeps ringing.
 */
function buildConfirmMacro(ctx = {}) {
    const name = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(ctx.name) || exports.CALL_GROUP_CONFIRM_MACRO;
    const digit = normalizeConfirmDigit(ctx.digit);
    return {
        name: `macro-${name}`,
        lines: [
            `[macro-${name}]`,
            'exten => s,1,NoOp(Call group confirm)',
            `same => n,Set(${exports.CALL_GROUP_CONFIRM_VAR}=0)`,
            'same => n,Read(KRSK_CG_DIGIT,beep,1,,,3)',
            `same => n,GotoIf($["\${KRSK_CG_DIGIT}" = "${digit}"]?accepted)`,
            'same => n,Set(MACRO_RESULT=CONTINUE)',
            `same => n,Return(\${${exports.CALL_GROUP_CONFIRM_VAR}})`,
            `same => n(accepted),Set(${exports.CALL_GROUP_CONFIRM_VAR}=1)`,
            `same => n,Return(\${${exports.CALL_GROUP_CONFIRM_VAR}})`,
        ],
    };
}
//# sourceMappingURL=call-group-confirm.util.js.map