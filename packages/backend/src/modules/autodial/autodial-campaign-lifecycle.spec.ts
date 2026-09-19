import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialDialplanService } from './autodial-dialplan.service';
import type { AcCampaign } from './models/ac-campaign.model';
import type { DialplanApplyService } from '../ami/dialplan-apply.service';
import type { AmiService } from '../ami/ami.service';

describe('autodial campaign start/stop safety', () => {
  const campaign = () => ({
    uid: 11, user_uid: 7, status: 'paused', trunk_pool: [{ trunk_id: 'trunk-1' }],
    update: jest.fn(),
  });
  const serviceWith = (row: ReturnType<typeof campaign>, applied: boolean) => {
    const service = Object.create(AutodialCampaignsService.prototype) as AutodialCampaignsService;
    jest.spyOn(service, 'getOrThrow').mockResolvedValue(row as unknown as AcCampaign);
    service['dialplanService'] = {
      assertAmdReady: jest.fn().mockResolvedValue(undefined),
      applyCampaign: jest.fn().mockResolvedValue(applied),
    } as unknown as AutodialDialplanService;
    service['endpointModel'] = {
      findAll: jest.fn().mockResolvedValue([{ id: 'trunk-1' }]),
    } as unknown as AutodialCampaignsService['endpointModel'];
    service['queueModel'] = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as AutodialCampaignsService['queueModel'];
    return service;
  };

  it('does not generate tasks or mark a campaign running when dialplan apply fails', async () => {
    const row = campaign();
    const service = serviceWith(row, false);
    service['generateTasks'] = jest.fn();
    await expect(service.start(7, 11)).rejects.toMatchObject({
      response: { code: 'AC_DIALPLAN_APPLY_FAILED' },
    });
    expect(service['generateTasks']).not.toHaveBeenCalled();
    expect(row.update).not.toHaveBeenCalled();
  });

  it('keeps a paused campaign paused if apply fails during resume', async () => {
    const row = campaign();
    const service = serviceWith(row, false);
    await expect(service.resume(7, 11)).rejects.toMatchObject({
      response: { code: 'AC_DIALPLAN_APPLY_FAILED' },
    });
    expect(row.update).not.toHaveBeenCalled();
  });

  it('does not reset dialing tasks while stopping the campaign', async () => {
    const row = campaign();
    const service = serviceWith(row, true);
    const update = jest.fn().mockResolvedValue([1]);
    service['taskModel'] = { update } as unknown as AutodialCampaignsService['taskModel'];
    jest.spyOn(service, 'findOne').mockResolvedValue({ status: 'stopped' } as never);
    await service.stop(7, 11);
    expect(row.update).toHaveBeenCalledWith({ status: 'stopped' });
    expect(update).toHaveBeenCalledWith(
      { leased_by: null, leased_at: null, status: 'pending' },
      { where: { campaign_uid: 11, user_uid: 7, status: 'leased' } },
    );
  });

  it('refuses to delete a stopped campaign while a call is still active', async () => {
    const row = { ...campaign(), status: 'stopped' };
    const service = serviceWith(row, true);
    const removeCampaign = jest.fn();
    service['taskModel'] = {
      count: jest.fn().mockResolvedValue(1),
      destroy: jest.fn(),
    } as unknown as AutodialCampaignsService['taskModel'];
    service['dialplanService'] = {
      removeCampaign,
    } as unknown as AutodialDialplanService;

    await expect(service.remove(7, 11)).rejects.toMatchObject({
      response: { code: 'AC_CAMPAIGN_ACTIVE_CALLS' },
    });
    expect(removeCampaign).not.toHaveBeenCalled();
    expect(service['taskModel'].destroy).not.toHaveBeenCalled();
  });
});

describe('autodial dialplan deployment result', () => {
  it('reports AMI apply failure instead of hiding it from lifecycle decisions', async () => {
    const apply = jest.fn().mockRejectedValue(new Error('AMI down'));
    const service = new AutodialDialplanService(
      { applyCategories: apply } as unknown as DialplanApplyService,
      { command: jest.fn() } as unknown as AmiService,
    );
    const row = {
      uid: 11, user_uid: 7, name: 'Test', amd: { enabled: false, on_machine: 'continue' },
      queue_names: [], scenario_actions: [],
    } as unknown as AcCampaign;
    await expect(service.applyCampaign(row)).resolves.toBe(false);
  });

  it('refuses AMD when the Asterisk module is not loaded', async () => {
    const command = jest.fn().mockResolvedValue({ output: '0 modules loaded' });
    const service = new AutodialDialplanService(
      { applyCategories: jest.fn() } as unknown as DialplanApplyService,
      { command } as unknown as AmiService,
    );
    const row = { amd: { enabled: true, on_machine: 'hangup' } } as AcCampaign;
    await expect(service.assertAmdReady(row)).rejects.toMatchObject({
      response: { code: 'AC_AMD_UNAVAILABLE' },
    });
    expect(command).toHaveBeenCalledWith('module show like app_amd');
  });

  it('allows AMD when app_amd is running', async () => {
    const service = new AutodialDialplanService(
      { applyCategories: jest.fn() } as unknown as DialplanApplyService,
      { command: jest.fn().mockResolvedValue({ output: ['app_amd.so  Answering machine detection  0  Running  core'] }) } as unknown as AmiService,
    );
    await expect(service.assertAmdReady({ amd: { enabled: true, on_machine: 'continue' } } as AcCampaign))
      .resolves.toBeUndefined();
  });

  it('blocks the unimplemented leave-message action before a PBX query', async () => {
    const command = jest.fn();
    const service = new AutodialDialplanService(
      { applyCategories: jest.fn() } as unknown as DialplanApplyService,
      { command } as unknown as AmiService,
    );
    await expect(service.assertAmdReady({ amd: { enabled: true, on_machine: 'voicemail' } } as AcCampaign))
      .rejects.toMatchObject({ response: { code: 'AC_AMD_MESSAGE_NOT_CONFIGURED' } });
    expect(command).not.toHaveBeenCalled();
  });
});
