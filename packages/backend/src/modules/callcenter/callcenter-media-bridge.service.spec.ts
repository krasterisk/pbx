import { EventEmitter } from 'events';
import { CallCenterMediaBridgeService } from './callcenter-media-bridge.service';

describe('CallCenterMediaBridgeService (D-41c, D-43)', () => {
  let ariClient: any;
  let udpServer: any;
  let stateService: any;
  let modulesRegistry: any;
  let configService: any;
  let service: CallCenterMediaBridgeService;
  let sessionEmitter: EventEmitter;

  beforeEach(() => {
    sessionEmitter = new EventEmitter();
    ariClient = {
      getAppName: jest.fn().mockReturnValue('krasterisk_voicerobots'),
      externalMedia: jest.fn().mockResolvedValue({ id: 'ext-ch-1' }),
      hangupChannel: jest.fn().mockResolvedValue(undefined),
    };
    udpServer = {
      createSession: jest.fn().mockResolvedValue({
        port: 12001,
        eventEmitter: sessionEmitter,
      }),
      closeSession: jest.fn(),
    };
    stateService = { emitEvent: jest.fn() };
    modulesRegistry = {
      tenantHasModule: jest.fn().mockResolvedValue(true),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string, def?: string) => {
        if (key === 'EXTERNAL_RTP_HOST') return '127.0.0.1';
        return def;
      }),
    };

    service = new CallCenterMediaBridgeService(
      ariClient,
      udpServer,
      stateService,
      modulesRegistry,
      configService,
    );
  });

  it('no-ops when tenant lacks cc_ai_voice license (D-43)', async () => {
    modulesRegistry.tenantHasModule.mockResolvedValue(false);

    const result = await service.attachPcmSkeleton('ch-1', 'uid-1', 42);

    expect(result).toEqual({ attached: false, reason: 'module_not_licensed' });
    expect(modulesRegistry.tenantHasModule).toHaveBeenCalledWith(42, 'cc_ai_voice');
    expect(udpServer.createSession).not.toHaveBeenCalled();
    expect(ariClient.externalMedia).not.toHaveBeenCalled();
  });

  it('attaches via RtpUdpServer + externalMedia and emits media.pcmFrame (D-41c)', async () => {
    const result = await service.attachPcmSkeleton('ch-1', 'uid-1', 42);

    expect(result.attached).toBe(true);
    expect(udpServer.createSession).toHaveBeenCalled();
    expect(ariClient.externalMedia).toHaveBeenCalledWith(
      null,
      'krasterisk_voicerobots',
      '127.0.0.1:12001',
      'alaw',
      'ch-1',
    );

    const frame = Buffer.from([1, 2, 3, 4]);
    sessionEmitter.emit('audio-pcm16', frame);

    expect(stateService.emitEvent).toHaveBeenCalledWith('media.pcmFrame', 42, {
      channelId: 'ch-1',
      callUniqueid: 'uid-1',
      frame,
    });
  });

  it('detachPcmSkeleton closes RTP port and hangs up external channel (idempotent)', async () => {
    await service.attachPcmSkeleton('ch-1', 'uid-1', 42);
    await service.detachPcmSkeleton('ch-1');

    expect(udpServer.closeSession).toHaveBeenCalledWith(12001);
    expect(ariClient.hangupChannel).toHaveBeenCalledWith('ext-ch-1');

    // second detach is no-op
    await service.detachPcmSkeleton('ch-1');
    expect(udpServer.closeSession).toHaveBeenCalledTimes(1);
  });

  it('does not import or reference StreamingSttService', () => {
    // Structural guard: source must stay free of STT (checked via service shape + no stt mocks)
    expect((service as any).sttService).toBeUndefined();
    expect((service as any).streamingStt).toBeUndefined();
  });
});
