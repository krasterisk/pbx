import { AutodialDialplanService } from './autodial-dialplan.service';
import type { DialplanApplyService } from '../ami/dialplan-apply.service';
import type { AmiService } from '../ami/ami.service';
import type { PromptsService } from '../prompts/prompts.service';
import type { AcCampaign } from './models/ac-campaign.model';

describe('AutodialDialplanService.applyCampaign', () => {
  it('writes a per-tenant finalize context and drops the legacy shared category', async () => {
    const applyCategories = jest.fn().mockResolvedValue({ success: true, linesApplied: 8 });
    const deleteCategories = jest.fn().mockResolvedValue({ success: true });
    const service = new AutodialDialplanService(
      { applyCategories, deleteCategories } as unknown as DialplanApplyService,
      {} as AmiService,
      {} as PromptsService,
    );
    const campaign = {
      uid: 9,
      user_uid: 2,
      name: 'T',
      amd: { enabled: false, on_machine: 'hangup' },
      queue_names: [],
      scenario_actions: [],
    } as unknown as AcCampaign;

    await expect(service.applyCampaign(campaign)).resolves.toBe(true);

    expect(applyCategories).toHaveBeenCalledWith(
      'krasterisk/autodial/ac_2.conf',
      [
        expect.objectContaining({ name: 'krsk-ac-9' }),
        expect.objectContaining({ name: 'krsk-ac-finalize-2' }),
      ],
      { reload: false },
    );
    expect(deleteCategories).toHaveBeenCalledWith(
      'krasterisk/autodial/ac_2.conf',
      ['krsk-ac-finalize'],
      { reload: true },
    );
  });
});
