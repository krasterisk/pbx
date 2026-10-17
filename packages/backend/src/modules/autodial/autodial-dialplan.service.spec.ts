import { AutodialDialplanService } from './autodial-dialplan.service';
import type { DialplanApplyService } from '../ami/dialplan-apply.service';
import type { AmiService } from '../ami/ami.service';
import type { PromptsService } from '../prompts/prompts.service';
import type { AcCampaign } from './models/ac-campaign.model';
import { DialplanApplyService as RealDialplanApplyService } from '../ami/dialplan-apply.service';
import { generateAutodialFinalizeContext, generateAutodialCampaignDialplan, withMachineTail } from './autodial-dialplan.util';

describe('AutodialDialplanService.applyCampaign', () => {
  it('serializes both callback applications as separate AMI Append values', async () => {
    const action = jest.fn().mockResolvedValue({ response: 'Success' });
    const writer = new RealDialplanApplyService({ action, command: jest.fn() } as never);
    const amd = { enabled: true, on_machine: 'hangup' as const };
    await writer.applyCategories('isolated-test.conf', [
      generateAutodialFinalizeContext(42),
      withMachineTail(generateAutodialCampaignDialplan({ uid: 7, name: 'T', amd, queue_names: [], scenario_actions: [] }, 42), amd, 42),
    ], { reload: false });
    const values = action.mock.calls.flatMap(([request]) => Object.entries(request)
      .filter(([key]) => key.startsWith('Value-')).map(([, value]) => String(value)));
    expect(values.filter((value) => value.includes('CURL('))).toHaveLength(2);
    expect(values.every((value) => !/[\r\n]/.test(value))).toBe(true);
    expect(values.some((value) => value.includes('internal/autodial/attempt-machine'))).toBe(true);
    expect(values.some((value) => value.includes('internal/autodial/attempt-result'))).toBe(true);
  });
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
