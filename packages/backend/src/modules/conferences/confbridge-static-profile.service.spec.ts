import { ConfbridgeStaticProfileService } from './confbridge-static-profile.service';
import { CONFERENCE_PLATFORM_CODECS } from './conference-dialplan.util';
import type { AmiService } from '../ami/ami.service';
import type { DialplanApplyService } from '../ami/dialplan-apply.service';

const LOADED_PROFILE = {
  output: 'Bridge Profile: krsk_conf_sfu\nvideo_mode: sfu',
};
const MISSING_PROFILE = {
  output: "No conference bridge profile named 'krsk_conf_sfu' found!",
};

describe('ConfbridgeStaticProfileService', () => {
  let amiService: { action: jest.Mock; command: jest.Mock };
  let dialplanApplyService: { applyCategories: jest.Mock };
  let service: ConfbridgeStaticProfileService;
  const savedCodecs = [...CONFERENCE_PLATFORM_CODECS];

  beforeEach(() => {
    CONFERENCE_PLATFORM_CODECS.splice(0, CONFERENCE_PLATFORM_CODECS.length, ...savedCodecs);
    amiService = {
      action: jest.fn(),
      command: jest.fn().mockImplementation((cmd: string) => {
        if (String(cmd).includes('confbridge show profile')) {
          return Promise.resolve(MISSING_PROFILE);
        }
        return Promise.resolve({ response: 'Success' });
      }),
    };
    dialplanApplyService = {
      applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 2 }),
    };
    service = new ConfbridgeStaticProfileService(
      amiService as unknown as AmiService,
      dialplanApplyService as unknown as DialplanApplyService,
      { backfillWebrtcVideo: jest.fn().mockResolvedValue(undefined) } as any,
    );
  });

  afterEach(() => {
    CONFERENCE_PLATFORM_CODECS.splice(0, CONFERENCE_PLATFORM_CODECS.length, ...savedCodecs);
  });

  function expectBridgeProfileWithoutAllow() {
    expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
      'confbridge.conf',
      [
        expect.objectContaining({
          name: 'krsk_conf_sfu',
          lines: [
            'type=bridge',
            'video_mode=sfu',
            'enable_events=yes',
            'record_file_timestamp=no',
          ],
        }),
      ],
      { reload: false },
    );
    const lines = dialplanApplyService.applyCategories.mock.calls[0][1][0].lines as string[];
    expect(lines.some((line) => line.startsWith('allow='))).toBe(false);
  }

  it('writes the SFU profile then reloads app_confbridge when GetConfig has no category', async () => {
    amiService.action.mockResolvedValue({ response: 'Success' });
    let showCalls = 0;
    amiService.command.mockImplementation((cmd: string) => {
      if (String(cmd).includes('confbridge show profile')) {
        showCalls += 1;
        return Promise.resolve(showCalls === 1 ? MISSING_PROFILE : LOADED_PROFILE);
      }
      return Promise.resolve({ response: 'Success' });
    });

    await service.onApplicationBootstrap();

    expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    expectBridgeProfileWithoutAllow();
    expect(amiService.command).toHaveBeenCalledWith('module reload app_confbridge.so');
  });

  it('is a no-op when the profile is loaded and the file has no allow=', async () => {
    amiService.action.mockResolvedValue({
      response: 'Success',
      'Category-000000': 'krsk_conf_sfu',
      'Line-000000-000000': 'type=bridge',
      'Line-000000-000001': 'video_mode=sfu',
      'Line-000000-000002': 'enable_events=yes',
      'Line-000000-000003': 'record_file_timestamp=no',
    });
    amiService.command.mockResolvedValue(LOADED_PROFILE);

    await service.onApplicationBootstrap();

    expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    expect(amiService.command).not.toHaveBeenCalledWith('module reload app_confbridge.so');
  });

  it('rewrites the category when GetConfig has krsk_conf_sfu but it includes allow=', async () => {
    amiService.action.mockResolvedValue({
      response: 'Success',
      'Category-000000': 'krsk_conf_sfu',
      'Line-000000-000002': 'allow=opus,ulaw,vp8',
    });
    amiService.command.mockResolvedValue(LOADED_PROFILE);

    await service.onApplicationBootstrap();

    expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    expectBridgeProfileWithoutAllow();
    expect(amiService.command).toHaveBeenCalledWith('module reload app_confbridge.so');
  });

  it('rewrites when krsk_conf_sfu is loaded but record_file_timestamp=no is missing', async () => {
    amiService.action.mockResolvedValue({
      response: 'Success',
      'Category-000000': 'krsk_conf_sfu',
      'Line-000000-000000': 'type=bridge',
      'Line-000000-000001': 'video_mode=sfu',
      'Line-000000-000002': 'enable_events=yes',
    });
    amiService.command.mockResolvedValue(LOADED_PROFILE);

    await service.onApplicationBootstrap();

    expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    expectBridgeProfileWithoutAllow();
    expect(amiService.command).toHaveBeenCalledWith('module reload app_confbridge.so');
  });

  it('rewrites when the file has the category but CLI did not load it', async () => {
    amiService.action.mockResolvedValue({
      response: 'Success',
      'Category-000000': 'krsk_conf_sfu',
      'Line-000000-000000': 'type=bridge',
      'Line-000000-000001': 'video_mode=sfu',
    });
    let showCalls = 0;
    amiService.command.mockImplementation((cmd: string) => {
      if (String(cmd).includes('confbridge show profile')) {
        showCalls += 1;
        return Promise.resolve(showCalls === 1 ? MISSING_PROFILE : LOADED_PROFILE);
      }
      return Promise.resolve({ response: 'Success' });
    });

    await service.onApplicationBootstrap();

    expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    expect(amiService.command).toHaveBeenCalledWith('module reload app_confbridge.so');
  });

  it('creates the category when confbridge.conf is missing or empty', async () => {
    amiService.action.mockRejectedValueOnce(new Error('File does not exist'));
    let showCalls = 0;
    amiService.command.mockImplementation((cmd: string) => {
      if (String(cmd).includes('confbridge show profile')) {
        showCalls += 1;
        return Promise.resolve(showCalls === 1 ? MISSING_PROFILE : LOADED_PROFILE);
      }
      return Promise.resolve({ response: 'Success' });
    });

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    expectBridgeProfileWithoutAllow();
  });

  it('locks the platform codec order to opus, ulaw, vp8 (D-25)', () => {
    expect(CONFERENCE_PLATFORM_CODECS.join(',')).toBe('opus,ulaw,vp8');
  });

  it('throws before writing when the platform codec list is empty', async () => {
    CONFERENCE_PLATFORM_CODECS.splice(0, CONFERENCE_PLATFORM_CODECS.length);
    amiService.action.mockResolvedValue({ response: 'Success' });

    await expect(service.onApplicationBootstrap()).rejects.toThrow();
    expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    expect(amiService.command).not.toHaveBeenCalled();
  });
});
