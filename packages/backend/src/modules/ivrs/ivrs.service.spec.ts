import { NotFoundException } from '@nestjs/common';
import { IvrsService } from './ivrs.service';
import { Ivr } from './ivr.model';
import { DialplanApplyService } from '../ami/dialplan-apply.service';

describe('IvrsService.generateIvrDialplan', () => {
  const dialplanApplyService = {
    applyCategories: jest.fn(),
    deleteCategories: jest.fn(),
  };
  const service = new IvrsService(null as any, null as any, dialplanApplyService as any);

  const baseIvr = {
    uid: 5,
    name: 'Test',
    timeout: '10',
    max_count: 0,
    menu_items: [],
  } as Ivr;

  it('emits Answer and Background for audio phrase', () => {
    const dp = service.generateIvrDialplan(
      { ...baseIvr, prompts: [{ kind: 'audio', filename: 'welcome.wav' }] } as Ivr,
      42,
    );
    expect(dp).toContain('[ivr_5]');
    expect(dp).toContain('exten => start,1,NoOp(IVR: Test)');
    expect(dp).toContain('same => n,Answer()');
    expect(dp).toContain('Background(/usr/records/42/sounds/welcome.wav)');
    expect(dp).not.toContain('say_bg.php');
  });

  it('emits CURL play-phrase for tts phrase', () => {
    const dp = service.generateIvrDialplan(
      {
        ...baseIvr,
        prompts: [{ kind: 'tts', text: 'Привет', engine_uid: 3 }],
      } as Ivr,
      42,
    );
    expect(dp).toContain('internal/ivr/play-phrase');
    expect(dp).toContain('phrase_index=0');
    expect(dp).toContain('ivr_uid=5');
    expect(dp).not.toContain('say_bg.php');
  });

  it('emits separate timeout settings in dialplan', () => {
    const dp = service.generateIvrDialplan(
      {
        ...baseIvr,
        timeout: '12',
        timeout_response: '8',
        timeout_digit: '3',
        prompts: [],
      } as Ivr,
      42,
    );
    expect(dp).toContain('Set(TIMEOUT(digit)=3)');
    expect(dp).toContain('Set(TIMEOUT(response)=8)');
    expect(dp).toContain('WaitExten(12)');
  });

  it('falls back response to waitExten when timeout_response missing', () => {
    const dp = service.generateIvrDialplan(
      { ...baseIvr, timeout: '15', prompts: [] } as Ivr,
      42,
    );
    expect(dp).toContain('Set(TIMEOUT(response)=15)');
    expect(dp).toContain('Set(TIMEOUT(digit)=5)');
    expect(dp).toContain('WaitExten(15)');
  });

  it('emits max extension when max_count > 0', () => {
    const dp = service.generateIvrDialplan(
      { ...baseIvr, max_count: 3, prompts: [] } as Ivr,
      42,
    );
    expect(dp).toContain(`goto(ivr_5,max,1)`);
    expect(dp).toContain('exten => max,1,NoOp(IVR max retries: Test)');
    expect(dp).toContain('same => n,Hangup()');
  });

  it('does not duplicate max when menu_items already defines max', () => {
    const dp = service.generateIvrDialplan(
      {
        ...baseIvr,
        max_count: 4,
        prompts: [],
        menu_items: [
          {
            digit: 'max',
            actions: [{ type: 'hangup', params: {} }],
          },
        ],
      } as Ivr,
      42,
    );
    expect(dp).toContain('goto(ivr_5,max,1)');
    expect(dp).toContain('exten => max,1,NoOp(IVR choice: max)');
    expect(dp).not.toContain('IVR max retries');
    expect((dp.match(/exten => max,1/g) || []).length).toBe(1);
  });

  it('emits menu digit actions', () => {
    const dp = service.generateIvrDialplan(
      {
        ...baseIvr,
        prompts: [],
        menu_items: [
          {
            digit: '1',
            actions: [{ type: 'hangup', params: {} }],
          },
        ],
      } as Ivr,
      42,
    );
    expect(dp).toContain('exten => 1,1,NoOp(IVR choice: 1)');
    expect(dp).toContain('Hangup()');
  });

  /**
   * ivrs.service.ts:249 — guard was missing; 12-05 renderActionChain adds WT_.
   */
  it('menu action with time_group_uid emits WT_ guard (guard appeared where it was absent)', () => {
    const dp = service.generateIvrDialplan(
      {
        ...baseIvr,
        prompts: [],
        menu_items: [
          {
            digit: '1',
            actions: [
              {
                type: 'hangup',
                params: {},
                condition: { time_group_uid: 12 },
              },
            ],
          },
        ],
      } as Ivr,
      42,
    );
    expect(dp).toMatch(/ExecIfTime|WT_/);
    expect(dp).toContain('ExecIf($["${WT_12}"="1"]?Hangup())');
  });

  it('menu action without time_group_uid stays Hangup() (12-01 baseline toBe)', () => {
    const dp = service.generateIvrDialplan(
      {
        ...baseIvr,
        prompts: [],
        menu_items: [
          {
            digit: '1',
            actions: [{ type: 'hangup', params: {}, condition: {} }],
          },
        ],
      } as Ivr,
      42,
    );
    expect(dp).toContain('same => n,Hangup()');
    expect(dp).not.toMatch(/ExecIfTime|WT_/);
  });
});

describe('IvrsService dialplan sync', () => {
  let ivrModel: any;
  let ttsEnginesService: any;
  let dialplanApplyService: jest.Mocked<Pick<DialplanApplyService, 'applyCategories' | 'deleteCategories'>>;
  let service: IvrsService;

  const vpbx = 42;

  const ivrRow = (overrides: Record<string, unknown> = {}) => {
    const data = {
      uid: 1,
      name: 'Menu',
      timeout: '10',
      max_count: 0,
      active: 1,
      direct_dial: 1,
      prompts: [],
      menu_items: [],
      user_uid: vpbx,
      ...overrides,
    };
    return {
      ...data,
      toJSON: () => ({ ...data }),
      update: jest.fn().mockImplementation(async (patch: Record<string, unknown>) => {
        Object.assign(data, patch);
      }),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  };

  beforeEach(() => {
    ivrModel = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
    };
    ttsEnginesService = {
      findOne: jest.fn(),
    };
    dialplanApplyService = {
      applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 5 }),
      deleteCategories: jest.fn().mockResolvedValue({ success: true }),
    };
    service = new IvrsService(
      ivrModel,
      ttsEnginesService,
      dialplanApplyService as unknown as DialplanApplyService,
    );
  });

  it('create applies dialplan category for active IVR', async () => {
    const created = ivrRow({ uid: 7, name: 'Sales', active: 1 });
    ivrModel.create.mockResolvedValueOnce(created);

    const result = await service.create({ name: 'Sales', active: 1 } as any, vpbx);

    expect(ivrModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sales', user_uid: vpbx }),
    );
    expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
      `krasterisk/ivrs/ivr_${vpbx}.conf`,
      [expect.objectContaining({ name: 'ivr_7' })],
      { reload: true },
    );
    expect(result.uid).toBe(7);
  });

  it('create removes dialplan when IVR is inactive', async () => {
    const created = ivrRow({ uid: 8, active: 0 });
    ivrModel.create.mockResolvedValueOnce(created);

    await service.create({ name: 'Off', active: 0 } as any, vpbx);

    expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    expect(dialplanApplyService.deleteCategories).toHaveBeenCalledWith(
      `krasterisk/ivrs/ivr_${vpbx}.conf`,
      ['ivr_8'],
      { reload: true },
    );
  });

  it('create still returns IVR when applyCategories fails after DB save', async () => {
    const created = ivrRow({ uid: 9 });
    ivrModel.create.mockResolvedValueOnce(created);
    dialplanApplyService.applyCategories.mockRejectedValueOnce(new Error('AMI down'));

    const result = await service.create({ name: 'X' } as any, vpbx);

    expect(result.uid).toBe(9);
  });

  it('update re-applies dialplan', async () => {
    const existing = ivrRow({ uid: 3, name: 'Old' });
    ivrModel.findOne.mockResolvedValueOnce(existing);

    await service.update(3, { name: 'New' } as any, vpbx);

    expect(existing.update).toHaveBeenCalled();
    expect(dialplanApplyService.applyCategories).toHaveBeenCalledWith(
      `krasterisk/ivrs/ivr_${vpbx}.conf`,
      [expect.objectContaining({ name: 'ivr_3' })],
      { reload: true },
    );
  });

  it('remove deletes dialplan category', async () => {
    const existing = ivrRow({ uid: 4 });
    ivrModel.findOne.mockResolvedValueOnce(existing);

    await service.remove(4, vpbx);

    expect(existing.destroy).toHaveBeenCalled();
    expect(dialplanApplyService.deleteCategories).toHaveBeenCalledWith(
      `krasterisk/ivrs/ivr_${vpbx}.conf`,
      ['ivr_4'],
      { reload: true },
    );
  });

  it('remove throws when IVR not found', async () => {
    ivrModel.findOne.mockResolvedValueOnce(null);
    await expect(service.remove(99, vpbx)).rejects.toBeInstanceOf(NotFoundException);
    expect(dialplanApplyService.deleteCategories).not.toHaveBeenCalled();
  });

  it('bulkRemove deletes categories for all uids', async () => {
    ivrModel.destroy.mockResolvedValueOnce(2);

    const result = await service.bulkRemove([1, 2], vpbx);

    expect(result).toEqual({ deleted: 2 });
    expect(dialplanApplyService.deleteCategories).toHaveBeenCalledWith(
      `krasterisk/ivrs/ivr_${vpbx}.conf`,
      ['ivr_1', 'ivr_2'],
      { reload: true },
    );
  });
});
