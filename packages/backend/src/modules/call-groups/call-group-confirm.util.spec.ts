import { parseOptions, serializeOptions } from '../../shared/utils/dialplan-options.util';
import {
  CALL_GROUP_CONFIRM_MACRO,
  CALL_GROUP_CONFIRM_VAR,
  buildConfirmMacro,
  confirmOption,
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
  });
});
