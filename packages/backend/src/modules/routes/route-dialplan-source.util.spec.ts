import { shouldUseStoredRawDialplan } from './route-dialplan-source.util';

const raw = 'exten => 1,1,Hangup()';
const actions = [{ type: 'voicerobot' }, { type: 'toexten' }];

describe('shouldUseStoredRawDialplan', () => {
  it('ignores a leftover snapshot when the action chain is present', () => {
    expect(shouldUseStoredRawDialplan({ actions, raw_dialplan: raw, options: {} })).toBe(false);
  });

  it('uses raw when the chain is empty', () => {
    expect(shouldUseStoredRawDialplan({ actions: [], raw_dialplan: raw })).toBe(true);
  });

  it('uses raw only when the editor source is raw', () => {
    expect(shouldUseStoredRawDialplan({
      actions,
      raw_dialplan: raw,
      options: { dialplan_source: 'raw' },
    })).toBe(true);
    expect(shouldUseStoredRawDialplan({
      actions,
      raw_dialplan: raw,
      options: { dialplan_source: 'actions' },
    })).toBe(false);
  });
});
