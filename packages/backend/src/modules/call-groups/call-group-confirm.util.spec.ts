import { parseOptions, serializeOptions } from '../../shared/utils/dialplan-options.util';
import {
  CALL_GROUP_CONFIRM_MACRO,
  CALL_GROUP_CONFIRM_VAR,
  DEFAULT_CONFIRM_DIGIT,
  buildConfirmMacro,
  confirmOption,
  normalizeConfirmDigit,
} from './call-group-confirm.util';

describe('call-group-confirm.util (D-34)', () => {
  it('confirmOption emits M(macroName) via serializeOptions', () => {
    const option = confirmOption(CALL_GROUP_CONFIRM_MACRO);
    expect(option).toContain(`M(${CALL_GROUP_CONFIRM_MACRO}`);
    expect(option.startsWith('M(')).toBe(true);
  });

  it('round-trips M(...) through parseOptions → serializeOptions without change', () => {
    const option = confirmOption(CALL_GROUP_CONFIRM_MACRO);
    const base = 'tT';
    const merged = serializeOptions({
      tokens: [...parseOptions(base).tokens, ...parseOptions(option).tokens],
    });
    expect(serializeOptions(parseOptions(merged))).toBe(merged);
    expect(merged).toBe(`tTM(${CALL_GROUP_CONFIRM_MACRO})`);
  });

  it('generated confirm macro waits for DTMF, Returns, and exposes the confirm flag', () => {
    const macro = buildConfirmMacro({ name: CALL_GROUP_CONFIRM_MACRO });
    const joined = macro.lines.join('\n');
    expect(joined).toMatch(/Read\(|WaitExten\(/);
    expect(joined).toContain('Return');
    expect(joined).toContain(CALL_GROUP_CONFIRM_VAR);
    expect(joined).toMatch(/MACRO_RESULT=CONTINUE|Set\(MACRO_RESULT/);
    expect(macro.name).toContain(CALL_GROUP_CONFIRM_MACRO);
    expect(joined).toContain(`= "${DEFAULT_CONFIRM_DIGIT}"`);
  });

  it('buildConfirmMacro embeds a custom confirm digit', () => {
    const macro = buildConfirmMacro({ name: CALL_GROUP_CONFIRM_MACRO, digit: '5' });
    expect(macro.lines.join('\n')).toContain('= "5"');
    expect(macro.lines.join('\n')).not.toContain('= "1"');
  });

  it('normalizeConfirmDigit falls back to 1 for invalid input', () => {
    expect(normalizeConfirmDigit('9')).toBe('9');
    expect(normalizeConfirmDigit('*')).toBe('*');
    expect(normalizeConfirmDigit('')).toBe(DEFAULT_CONFIRM_DIGIT);
    expect(normalizeConfirmDigit('12')).toBe(DEFAULT_CONFIRM_DIGIT);
    expect(normalizeConfirmDigit('x')).toBe(DEFAULT_CONFIRM_DIGIT);
  });
});
