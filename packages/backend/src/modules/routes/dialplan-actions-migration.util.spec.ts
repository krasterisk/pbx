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
    name: 'D-28 sendmail → notify email channel',
    input: {
      type: 'sendmail',
      params: { email: 'ops@example.com', subject: 'Missed', text: 'Call from ${CALLERID(num)}' },
    },
    expected: {
      type: 'notify',
      params: {
        channels: ['email'],
        recipients: { email: 'ops@example.com' },
        subject: 'Missed',
        body: 'Call from ${CALLERID(num)}',
      },
    },
  },
  {
    name: 'D-28 sendmailpeer → notify email via exten',
    input: { type: 'sendmailpeer', params: { exten: '101', text: 'missed' } },
    expected: {
      type: 'notify',
      params: {
        channels: ['email'],
        recipients: { email: '101' },
        body: 'missed',
      },
    },
  },
  {
    name: 'D-28 telegram → notify telegram channel',
    input: { type: 'telegram', params: { chat_id: '-100123', text: 'hello' } },
    expected: {
      type: 'notify',
      params: {
        channels: ['telegram'],
        recipients: { telegram: '-100123' },
        body: 'hello',
      },
    },
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

  it('keeps remainder keys when folding sendmail', () => {
    const result = migrateAction({
      type: 'sendmail',
      params: { email: 'a@b.c', subject: 's', text: 't', legacyThing: true },
    });
    expect(result.action).toEqual({
      type: 'notify',
      params: {
        channels: ['email'],
        recipients: { email: 'a@b.c' },
        subject: 's',
        body: 't',
        legacyThing: true,
      },
    });
  });

  it.each(['asr', 'tofax', 'keywords'] as const)(
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
      params: { channels: ['email'], recipients: { email: 'a@b.c' }, body: 't' },
    };
    expect(migrateAction(playback)).toEqual({ action: playback, changed: false });
    expect(migrateAction(notify)).toEqual({ action: notify, changed: false });
  });

  it('leaves a truly unknown type in place without substituting another type', () => {
    const input = { type: 'custom_future', params: { foo: 1 } };
    const result = migrateAction(input);
    expect(result.action).toEqual(input);
    expect(result.changed).toBe(false);
    expect(result.unmapped).toBe('custom_future');
  });
});
