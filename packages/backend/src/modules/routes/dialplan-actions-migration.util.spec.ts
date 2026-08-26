import { migrateAction } from './dialplan-actions-migration.util';

const SENTINEL = '__USE_EXTEN__';

const TRANSITIONS: Array<{
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  changed?: boolean;
  unmapped?: string;
}> = [
  {
    name: 'D-20 toqueue string queue → target.fixed',
    input: { type: 'toqueue', params: { queue: 'sales' } },
    expected: { type: 'toqueue', params: { target: { source: 'fixed', value: 'sales' } } },
  },
  {
    name: 'D-20 toexten sentinel → target.route_pattern',
    input: { type: 'toexten', params: { exten: SENTINEL } },
    expected: { type: 'toexten', params: { target: { source: 'route_pattern' } } },
  },
  {
    name: 'D-20 toexten useExten flag → target.route_pattern',
    input: { type: 'toexten', params: { useExten: true, exten: '' } },
    expected: { type: 'toexten', params: { target: { source: 'route_pattern' } } },
  },
  {
    name: 'D-20 empty string target field → route_pattern',
    input: { type: 'toqueue', params: { queue: '' } },
    expected: { type: 'toqueue', params: { target: { source: 'route_pattern' } } },
  },
  {
    name: 'D-20 togroup string group → target.fixed',
    input: { type: 'togroup', params: { group: 'sales' } },
    expected: { type: 'togroup', params: { target: { source: 'fixed', value: 'sales' } } },
  },
  {
    name: 'D-20 totrunk dest sentinel → dest.route_pattern',
    input: { type: 'totrunk', params: { trunk: 'sip', dest: SENTINEL } },
    expected: { type: 'totrunk', params: { trunk: 'sip', dest: { source: 'route_pattern' } } },
  },
  {
    name: 'D-20 toroute context string → context.fixed',
    input: { type: 'toroute', params: { context: 'from-internal' } },
    expected: { type: 'toroute', params: { context: { source: 'fixed', value: 'from-internal' } } },
  },
  {
    name: 'D-51 playprompt → playback mode plain (no interrupt)',
    input: { type: 'playprompt', params: { file: 'x' } },
    expected: { type: 'playback', params: { file: 'x', mode: 'plain' } },
  },
  {
    name: 'D-51 playback → playback mode control (interrupt)',
    input: { type: 'playback', params: { file: 'x' } },
    expected: { type: 'playback', params: { file: 'x', mode: 'control' } },
  },
  {
    name: 'D-51 background → playback mode menu (digit exit)',
    input: { type: 'background', params: { file: 'x' } },
    expected: { type: 'playback', params: { file: 'x', mode: 'menu' } },
  },
  {
    name: 'busy → hangup with the busy signal',
    input: { type: 'busy', params: { timeout: 15 } },
    expected: { type: 'hangup', params: { timeout: 15, signal: 'busy' } },
  },
  {
    name: 'congestion → hangup with the congestion signal',
    input: { type: 'congestion', params: {} },
    expected: { type: 'hangup', params: { signal: 'congestion' } },
  },
  {
    name: 'bare hangup gains an explicit signal',
    input: { type: 'hangup', params: { causecode: '17' } },
    expected: { type: 'hangup', params: { causecode: '17', signal: 'hangup' } },
  },
  {
    name: 'branch → goto with the then-label lifted onto label_name',
    input: {
      type: 'branch',
      params: {
        true_label: 'ok',
        false_label: 'fail',
        condition: { source: 'dialstatus', values: ['ANSWER'] },
      },
    },
    expected: {
      type: 'goto',
      params: {
        label_name: 'ok',
        false_label: 'fail',
        condition: { source: 'dialstatus', values: ['ANSWER'] },
      },
    },
  },
  {
    name: 'setclid_custom → callerid static mode',
    input: { type: 'setclid_custom', params: { callerid: '7900', name: 'Sales' } },
    expected: { type: 'callerid', params: { callerid: '7900', name: 'Sales', mode: 'static' } },
  },
  {
    name: 'setclid_list → callerid number_list mode',
    input: { type: 'setclid_list', params: { list_uid: 5 } },
    expected: { type: 'callerid', params: { list_uid: 5, mode: 'number_list' } },
  },
  {
    name: 'legacy callerid setclid_list mode is renamed to number_list',
    input: { type: 'callerid', params: { mode: 'setclid_list', list_uid: 5 } },
    expected: { type: 'callerid', params: { mode: 'number_list', list_uid: 5 } },
  },
];

describe('migrateAction', () => {
  it.each(TRANSITIONS)('$name', ({ input, expected }) => {
    expect(migrateAction(input)).toEqual({ action: expected, changed: true });
  });

  it('is idempotent: second apply equals first for every transition', () => {
    for (const { input } of TRANSITIONS) {
      const first = migrateAction(input).action;
      expect(migrateAction(first).action).toEqual(first);
    }
  });

  it('does not wrap an already structural ValueSource', () => {
    const already = {
      type: 'toqueue',
      params: { target: { source: 'fixed', value: 'sales' } },
    };
    expect(migrateAction(already)).toEqual({ action: already, changed: false });
    expect(migrateAction(already).action).toEqual(already);
  });

  it('keeps unmapped remainder keys on params', () => {
    const result = migrateAction({
      type: 'toqueue',
      params: { queue: 'sales', legacyThing: 42 },
    });
    expect(result.action).toEqual({
      type: 'toqueue',
      params: { target: { source: 'fixed', value: 'sales' }, legacyThing: 42 },
    });
    expect(result.changed).toBe(true);
  });

  it('keeps remainder keys when folding a merged type', () => {
    const result = migrateAction({
      type: 'setclid_custom',
      params: { callerid: 'a', name: 's', legacyThing: true },
    });
    expect(result.action).toEqual({
      type: 'callerid',
      params: { callerid: 'a', name: 's', legacyThing: true, mode: 'static' },
    });
  });

  it.each(['asr', 'tofax', 'keywords', 'sendmail', 'sendmailpeer', 'telegram'] as const)(
    'unknown-state: %s stays unchanged and is marked unmapped',
    (type) => {
      const input = { type, params: { silence_timeout: 3, email: 'fax@x' } };
      const result = migrateAction(input);
      expect(result).toEqual({ action: input, changed: false, unmapped: type });
      expect(result.action).toEqual(input);
    },
  );

  it('does not rewrite a fully migrated playback+notify pair', () => {
    const playback = {
      type: 'playback',
      params: { file: 'x', mode: 'plain' },
    };
    const notify = {
      type: 'notify',
      params: { integration_uid: 4, target: 'a@b.c', body: 't' },
    };
    expect(migrateAction(playback)).toEqual({ action: playback, changed: false });
    expect(migrateAction(notify)).toEqual({ action: notify, changed: false });
  });

  it('lifts dest ${EXTEN} and top-level strip/prepend into rewrite', () => {
    const result = migrateAction({
      type: 'totrunk',
      params: { trunk: 'sip', dest: '${EXTEN}', strip: 1, prepend: '8' },
    });
    expect(result.changed).toBe(true);
    expect(result.action).toEqual({
      type: 'totrunk',
      params: {
        trunk: 'sip',
        dest: { source: 'route_pattern' },
        rewrite: {
          noMatch: 'passthrough',
          rules: [{
            id: 'legacy',
            enabled: true,
            conditions: [],
            transform: { stripStartCount: 1, prefix: '8' },
          }],
        },
      },
    });
  });

  it('migrates legacy trunk_carousel type to totrunk with trunkMode=carousel', () => {
    const result = migrateAction({
      type: 'trunk_carousel',
      params: {
        mode: 'random_then_failover',
        trunks: [{ trunk: 'PJSIP/t1', cid_mode: 'static' }],
        timeout: 60,
      },
    });
    expect(result.changed).toBe(true);
    expect(result.action).toEqual({
      type: 'totrunk',
      params: {
        trunkMode: 'carousel',
        mode: 'random_then_failover',
        trunks: [{ trunk: 'PJSIP/t1', cid_mode: 'static' }],
        timeout: 60,
      },
    });
  });

  it('leaves a truly unknown type in place without substituting another type', () => {
    const input = { type: 'custom_future', params: { foo: 1 } };
    const result = migrateAction(input);
    expect(result.action).toEqual(input);
    expect(result.changed).toBe(false);
    expect(result.unmapped).toBe('custom_future');
  });
});
