import {
  DIAGNOSTIC_READ_COMMANDS,
  DiagnosticsService,
  LIVE_CHANNEL_CAP,
  resolveDiagnosticCommand,
} from './diagnostics.service';

const TENANT_A = 12;
const TENANT_B = 34;

const CONCISE_TWO_TENANTS = [
  'PJSIP/e100_12-00000001!ctx-12!100!1!Up!Dial!PJSIP/e200_12!Alice <100>!00:00:12',
  'PJSIP/e200_34-00000002!ctx-34!200!1!Ring!AppDial!(Outgoing Line)!Bob <200>!00:00:03',
].join('\n');

function createService(overrides?: {
  command?: jest.Mock;
  contexts?: unknown[];
  endpoints?: unknown[];
}): {
  service: DiagnosticsService;
  ami: { command: jest.Mock };
} {
  const ami = { command: overrides?.command ?? jest.fn() };
  const contextsService = {
    findAll: jest.fn(async (uid: number) => {
      if (overrides?.contexts) return overrides.contexts;
      if (uid === TENANT_A) return [{ name: 'ctx-12', user_uid: TENANT_A }];
      if (uid === TENANT_B) return [{ name: 'ctx-34', user_uid: TENANT_B }];
      return [];
    }),
  };
  const endpointsService = {
    findAll: jest.fn(async (uid: number) => {
      if (overrides?.endpoints) return overrides.endpoints;
      if (uid === TENANT_A) return [{ id: 'e100_12' }];
      if (uid === TENANT_B) return [{ id: 'e200_34' }];
      return [];
    }),
  };
  const service = new DiagnosticsService(
    ami as any,
    contextsService as any,
    endpointsService as any,
  );
  return { service, ami };
}

describe('DiagnosticsService — live channels (D-12, D-22)', () => {
  it('issues only the allow-listed live_channels command', async () => {
    const { service, ami } = createService({
      command: jest.fn().mockResolvedValue({ output: CONCISE_TWO_TENANTS }),
    });

    await service.readLiveChannels(TENANT_A);

    expect(ami.command).toHaveBeenCalledTimes(1);
    expect(ami.command).toHaveBeenCalledWith(DIAGNOSTIC_READ_COMMANDS.live_channels);
    expect(ami.command.mock.calls[0][0]).toBe('core show channels concise');
  });

  it('refuses a command name that is not on the allow list before reaching the switch', () => {
    const ami = { command: jest.fn() };
    expect(() => resolveDiagnosticCommand('core restart now')).toThrow(/not allowed/i);
    expect(() => resolveDiagnosticCommand('hangup')).toThrow(/not allowed/i);
    expect(() => resolveDiagnosticCommand('originate')).toThrow(/not allowed/i);
    expect(ami.command).not.toHaveBeenCalled();
    expect(Object.keys(DIAGNOSTIC_READ_COMMANDS)).toEqual(
      expect.arrayContaining(['live_channels']),
    );
    expect(Object.values(DIAGNOSTIC_READ_COMMANDS)).not.toEqual(
      expect.arrayContaining(['core restart now', 'hangup', 'originate']),
    );
  });

  it('returns only channels whose context or endpoint belongs to the calling tenant', async () => {
    const { service } = createService({
      command: jest.fn().mockResolvedValue({ output: CONCISE_TWO_TENANTS }),
    });

    const result = await service.readLiveChannels(TENANT_A);
    const channels = result.channels;

    expect(channels).toHaveLength(1);
    expect(channels[0].channel).toContain('e100_12');
    expect(channels[0].context).toBe('ctx-12');
    expect(JSON.stringify(result)).not.toContain('e200_34');
    expect(JSON.stringify(result)).not.toContain('ctx-34');
  });

  it('two-tenant fixture: each tenant sees only its own live channels', async () => {
    const command = jest.fn().mockResolvedValue({ output: CONCISE_TWO_TENANTS });
    const { service: serviceA } = createService({ command });
    const { service: serviceB } = createService({ command });

    const forA = await serviceA.readLiveChannels(TENANT_A);
    const forB = await serviceB.readLiveChannels(TENANT_B);

    expect(forA.channels.map((c) => c.channel)).toEqual(['PJSIP/e100_12-00000001']);
    expect(forB.channels.map((c) => c.channel)).toEqual(['PJSIP/e200_34-00000002']);
    expect(forA.channels.some((c) => c.context === 'ctx-34')).toBe(false);
    expect(forB.channels.some((c) => c.context === 'ctx-12')).toBe(false);
  });

  it('caps the result at the documented channel count and reports truncation', async () => {
    const lines = Array.from({ length: LIVE_CHANNEL_CAP + 5 }, (_, i) => {
      const n = String(i).padStart(8, '0');
      return `PJSIP/e100_12-${n}!ctx-12!100!1!Up!Dial!PJSIP/e200_12!Alice <100>!00:00:01`;
    }).join('\n');
    const { service } = createService({
      command: jest.fn().mockResolvedValue({ output: lines }),
    });

    const result = await service.readLiveChannels(TENANT_A);

    expect(LIVE_CHANNEL_CAP).toBeGreaterThan(0);
    expect(result.channels).toHaveLength(LIVE_CHANNEL_CAP);
    expect(result.truncated).toBe(true);
    expect(result.cap).toBe(LIVE_CHANNEL_CAP);
    expect(result.matched).toBe(LIVE_CHANNEL_CAP + 5);
  });

  it('does not report truncation when the tenant channel count is within the cap', async () => {
    const { service } = createService({
      command: jest.fn().mockResolvedValue({ output: CONCISE_TWO_TENANTS }),
    });

    const result = await service.readLiveChannels(TENANT_A);

    expect(result.truncated).toBe(false);
    expect(result.channels).toHaveLength(1);
    expect(result.cap).toBe(LIVE_CHANNEL_CAP);
  });
});
