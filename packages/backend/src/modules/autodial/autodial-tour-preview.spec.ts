import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { parseTourDispositions } from './autodial-tour-preview';

describe('tour selection and admission boundaries', () => {
  it('accepts an empty selection and deduplicates supported outcomes', () => {
    expect(parseTourDispositions(undefined)).toEqual([]);
    expect(parseTourDispositions('busy, no_answer,busy')).toEqual(['busy', 'no_answer']);
  });
  it.each([['busy'], {}, 'busy; DROP TABLE ac_tasks', 'unknown', 'a'.repeat(513)])('rejects malformed filters before any lookup: %s', async (raw) => {
    const service = Object.create(AutodialCampaignsService.prototype) as AutodialCampaignsService;
    const lookup = jest.spyOn(service, 'getOrThrow').mockRejectedValue(new Error('should not query'));
    await expect(service.previewTour(7, 11, raw)).rejects.toBeInstanceOf(BadRequestException);
    expect(lookup).not.toHaveBeenCalled();
  });
  it('does not read audience or base details for an inaccessible campaign', async () => {
    const service = Object.create(AutodialCampaignsService.prototype) as AutodialCampaignsService;
    jest.spyOn(service, 'getOrThrow').mockRejectedValue(new NotFoundException());
    const read = jest.fn(); service['basesService'] = { findOne: read } as never;
    service['sequelize'] = { query: jest.fn() } as never;
    await expect(service.previewTour(8, 11, 'busy')).rejects.toBeInstanceOf(NotFoundException);
    expect(read).not.toHaveBeenCalled(); expect(service['sequelize'].query).not.toHaveBeenCalled();
  });
  it('rejects a stale campaign before applying dialplan or generating calls', async () => {
    const service = Object.create(AutodialCampaignsService.prototype) as AutodialCampaignsService;
    jest.spyOn(service, 'getOrThrow').mockResolvedValue({ uid: 11, revision: 4, status: 'completed' } as never);
    service['dialplanService'] = { applyCampaign: jest.fn() } as never;
    await expect(service.start(7, 11, { expected_revision: 3 })).rejects.toMatchObject({
      response: { code: 'AC_CAMPAIGN_REVISION_CONFLICT' },
    });
    expect(service['dialplanService'].applyCampaign).not.toHaveBeenCalled();
  });
  it('rejects a changed audience before applying dialplan', async () => {
    const service = Object.create(AutodialCampaignsService.prototype) as AutodialCampaignsService;
    jest.spyOn(service, 'getOrThrow').mockResolvedValue({ uid: 11, base_uid: 8, revision: 4, status: 'completed' } as never);
    const read = jest.fn().mockResolvedValue({ revision: 9 }); service['basesService'] = { findOne: read } as never;
    service['dialplanService'] = { applyCampaign: jest.fn() } as never;
    await expect(service.start(7, 11, { expected_revision: 4, expected_base_revision: 8 })).rejects.toMatchObject({
      response: { code: 'AC_REVISION_CONFLICT' },
    });
    expect(read).toHaveBeenCalledWith(7, 8);
    expect(service['dialplanService'].applyCampaign).not.toHaveBeenCalled();
  });
  it('closes a base-revision race under the transaction lock before changing the tour', async () => {
    const service = Object.create(AutodialCampaignsService.prototype) as AutodialCampaignsService;
    const row = { uid: 11, base_uid: 8, revision: 4, status: 'completed', trunk_pool: [{ trunk_id: 'test' }],
      scenario_actions: [], queue_names: [], dial_mode: 'agentless', update: jest.fn() };
    jest.spyOn(service, 'getOrThrow').mockResolvedValue(row as never);
    const lock = jest.fn().mockResolvedValue({ revision: 9 });
    service['basesService'] = { findOne: jest.fn().mockResolvedValue({ revision: 8 }), lockBase: lock } as never;
    service['assertScenario'] = jest.fn();
    service['assertQueueReferences'] = jest.fn();
    service['assertExtensionReferences'] = jest.fn();
    service['assertStoredTrunkPoolConfig'] = jest.fn();
    service['dialplanService'] = { assertAmdReady: jest.fn() } as never;
    service['applyAndRecord'] = jest.fn().mockResolvedValue(true);
    service['attemptModel'] = { count: jest.fn().mockResolvedValue(0) } as never;
    const transaction = { test: 'atomic admission' };
    service['sequelize'] = { transaction: (write: (tx: unknown) => Promise<unknown>) => write(transaction) } as never;
    service['generateTasks'] = jest.fn();
    await expect(service.start(7, 11, { expected_revision: 4, expected_base_revision: 8 })).rejects.toMatchObject({
      response: { code: 'AC_REVISION_CONFLICT' },
    });
    expect(lock).toHaveBeenCalledWith(7, 8, transaction);
    expect(row.update).not.toHaveBeenCalled();
    expect(service['generateTasks']).not.toHaveBeenCalled();
  });
});
