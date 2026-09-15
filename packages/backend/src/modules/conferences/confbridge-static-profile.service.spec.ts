import { ConfbridgeStaticProfileService } from './confbridge-static-profile.service';
import { CONFERENCE_PLATFORM_CODECS } from './conference-dialplan.util';
import type { AmiService } from '../ami/ami.service';
import type { DialplanApplyService } from '../ami/dialplan-apply.service';

describe('ConfbridgeStaticProfileService', () => {
  let amiService: { action: jest.Mock; command: jest.Mock };
  let dialplanApplyService: { applyCategories: jest.Mock };
  let service: ConfbridgeStaticProfileService;
  const savedCodecs = [...CONFERENCE_PLATFORM_CODECS];

  beforeEach(() => {
    CONFERENCE_PLATFORM_CODECS.splice(0, CONFERENCE_PLATFORM_CODECS.length, ...savedCodecs);
    amiService = {
      action: jest.fn(),
      command: jest.fn().mockResolvedValue({ response: 'Success' }),
    };
    dialplanApplyService = {
      applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 2 }),
    };
    service = new ConfbridgeStaticProfileService(
      amiService as unknown as AmiService,
      dialplanApplyService as unknown as DialplanApplyService,
    );
  });

  afterEach(() => {
    CONFERENCE_PLATFORM_CODECS.splice(0, CONFERENCE_PLATFORM_CODECS.length, ...savedCodecs);
  });

  it('writes the SFU profile then reloads app_confbridge when GetConfig has no category', async () => {
    amiService.action.mockResolvedValue({ response: 'Success' });

    await service.onApplicationBootstrap();

    expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
      'confbridge.conf',
      [expect.objectContaining({ name: 'krsk_conf_sfu' })],
      { reload: false },
    );
    expect(amiService.command).toHaveBeenCalledTimes(1);
    expect(amiService.command).toHaveBeenCalledWith('module reload app_confbridge.so');
    expect(dialplanApplyService.applyCategories.mock.invocationCallOrder[0]).toBeLessThan(
      amiService.command.mock.invocationCallOrder[0],
    );
  });

  it('is a no-op when krsk_conf_sfu already exists', async () => {
    amiService.action.mockResolvedValue({
      response: 'Success',
      'Category-000000': 'krsk_conf_sfu',
    });

    await service.onApplicationBootstrap();

    expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    expect(amiService.command).not.toHaveBeenCalled();
  });

  it('creates the category when confbridge.conf is missing or empty', async () => {
    amiService.action.mockRejectedValueOnce(new Error('File does not exist'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(dialplanApplyService.applyCategories).toHaveBeenCalledTimes(1);
    expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
      'confbridge.conf',
      [expect.objectContaining({ name: 'krsk_conf_sfu' })],
      { reload: false },
    );
  });

  it('throws before writing when the platform codec list is empty', async () => {
    CONFERENCE_PLATFORM_CODECS.splice(0, CONFERENCE_PLATFORM_CODECS.length);
    amiService.action.mockResolvedValue({ response: 'Success' });

    await expect(service.onApplicationBootstrap()).rejects.toThrow();
    expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    expect(amiService.command).not.toHaveBeenCalled();
  });
});
