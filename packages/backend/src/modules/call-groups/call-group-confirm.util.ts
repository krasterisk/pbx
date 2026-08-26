import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import { parseOptions, serializeOptions } from '../../shared/utils/dialplan-options.util';

export interface ConfirmMacroCategory {
  name: string;
  lines: string[];
}

/** Macro name used by Dial() option M(...) — only for external members (D-34). */
export const CALL_GROUP_CONFIRM_MACRO = 'krsk-cg-confirm';

/** Channel variable set to 1 when the callee pressed the confirm digit. */
export const CALL_GROUP_CONFIRM_VAR = 'KRSK_CG_CONFIRMED';

/** Default DTMF key for external answer confirmation. */
export const DEFAULT_CONFIRM_DIGIT = '1';

const CONFIRM_DIGIT_PATTERN = /^[0-9*#]$/;

/**
 * Single DTMF key (0-9, *, #). Invalid / empty values fall back to {@link DEFAULT_CONFIRM_DIGIT}.
 */
export function normalizeConfirmDigit(digit?: string | null): string {
  const raw = String(digit ?? '').trim();
  return CONFIRM_DIGIT_PATTERN.test(raw) ? raw : DEFAULT_CONFIRM_DIGIT;
}

/**
 * External = `member_type === 'external'` — the same flag `memberInterface` uses
 * to emit LOCAL/ rather than PJSIP/. Internals never go through operator VM.
 */
export function confirmOption(macroName: string): string {
  const safe = AsteriskDialplanUtils.sanitizeDialplanInput(macroName) || CALL_GROUP_CONFIRM_MACRO;
  return serializeOptions(parseOptions(`M(${safe})`));
}

export function mergeDialOptions(base: string, extra: string): string {
  return serializeOptions({
    tokens: [...parseOptions(base).tokens, ...parseOptions(extra).tokens],
  });
}

/** Remove Dial `m` / `m(...)` tokens — MOH is applied via useMohInsteadOfRingback. */
export function stripMohDialTokens(opts: string): string {
  return serializeOptions({
    tokens: parseOptions(opts).tokens.filter((token) => token !== 'm' && !token.startsWith('m(')),
  });
}

/**
 * Asterisk Macro context `[macro-<name>]`. Dial option M(name) runs it on the
 * called channel after answer. Wrong/missing DTMF sets MACRO_RESULT=CONTINUE
 * so Dial() does not treat the leg as answered and the group keeps ringing.
 */
export function buildConfirmMacro(
  ctx: { name?: string; digit?: string | null } = {},
): ConfirmMacroCategory {
  const name = AsteriskDialplanUtils.sanitizeDialplanInput(ctx.name) || CALL_GROUP_CONFIRM_MACRO;
  const digit = normalizeConfirmDigit(ctx.digit);
  return {
    name: `macro-${name}`,
    lines: [
      `[macro-${name}]`,
      'exten => s,1,NoOp(Call group confirm)',
      `same => n,Set(${CALL_GROUP_CONFIRM_VAR}=0)`,
      'same => n,Read(KRSK_CG_DIGIT,beep,1,,,3)',
      `same => n,GotoIf($["\${KRSK_CG_DIGIT}" = "${digit}"]?accepted)`,
      'same => n,Set(MACRO_RESULT=CONTINUE)',
      `same => n,Return(\${${CALL_GROUP_CONFIRM_VAR}})`,
      `same => n(accepted),Set(${CALL_GROUP_CONFIRM_VAR}=1)`,
      `same => n,Return(\${${CALL_GROUP_CONFIRM_VAR}})`,
    ],
  };
}
