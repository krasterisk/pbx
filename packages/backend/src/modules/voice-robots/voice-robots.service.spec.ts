import { VoiceRobotsService } from './voice-robots.service';

/**
 * Wave 0 characterization of the three actionToDialplan call sites in
 * generateAllVoiceRobotContexts. Nest is not started — models are mocked.
 *
 * Line map (current source, 12-01):
 *   444 — max_retries_action
 *   456 — fallback_action
 *   479 — keyword.actions (vr_keywords)
 * PLAN.md swapped 444/456 labels vs this file; tests follow the source.
 */
describe('VoiceRobotsService.generateAllVoiceRobotContexts (Wave 0 characterization)', () => {
  let voiceRobotModel: { findAll: jest.Mock };
  let groupModel: { findAll: jest.Mock };
  let keywordModel: { findAll: jest.Mock };
  let service: VoiceRobotsService;

  beforeEach(() => {
    voiceRobotModel = { findAll: jest.fn() };
    groupModel = { findAll: jest.fn().mockResolvedValue([]) };
    keywordModel = { findAll: jest.fn().mockResolvedValue([]) };
    const configService = { get: jest.fn().mockReturnValue('127.0.0.1') };
    const ariClient = { getAppName: () => 'krasterisk_voicerobots' };
    service = new VoiceRobotsService(
      voiceRobotModel as any,
      groupModel as any,
      keywordModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      ariClient as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      configService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  /**
   * voice-robots.service.ts:444 — max_retries_action without time-group guard.
   * 12-05 must wrap this call site.
   */
  it('max_retries_action (line 444) emits WT_ guard when time_group_uid is set', async () => {
    voiceRobotModel.findAll.mockResolvedValue([
      {
        uid: 9,
        name: 'Bot',
        max_retries_action: [
          { type: 'hangup', params: {}, condition: { time_group_uid: 12 } },
        ],
        fallback_action: [],
      },
    ]);
    const dp = await service.generateAllVoiceRobotContexts(42);
    expect(dp).toMatch(/ExecIfTime|WT_/);
  });

  it('max_retries_action (line 444) happy-path Hangup is exact', async () => {
    voiceRobotModel.findAll.mockResolvedValue([
      {
        uid: 9,
        name: 'Bot',
        max_retries_action: [{ type: 'hangup', params: {}, condition: {} }],
        fallback_action: [],
      },
    ]);
    const dp = await service.generateAllVoiceRobotContexts(42);
    expect(dp).toBe(
      [
        '; ===== Voice Robot: Bot (UID: 9) =====',
        '[voicerobot_9]',
        'exten => s,1,NoOp(Starting Voice Robot: Bot)',
        'same => n,Stasis(krasterisk_voicerobots, 9)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "SUCCESS"]?end_robot)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "MAX_RETRIES"]?max_retries)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "MAX_DURATION"]?max_retries)',
        'same => n,Gosub(voicerobot_fallback_9,s,1)',
        'same => n(end_robot),Return()',
        'same => n(max_retries),NoOp(Max retries for Bot)',
        'same => n,Hangup()',
        'same => n,Return()',
        '',
        '[voicerobot_fallback_9]',
        'exten => s,1,NoOp(Fallback for Robot: Bot)',
        'same => n,Return()',
        '',
      ].join('\n'),
    );
  });

  /**
   * voice-robots.service.ts:456 — fallback_action without time-group guard.
   * 12-05 must wrap this call site.
   */
  it('fallback_action (line 456) emits WT_ guard when time_group_uid is set', async () => {
    voiceRobotModel.findAll.mockResolvedValue([
      {
        uid: 9,
        name: 'Bot',
        max_retries_action: [],
        fallback_action: [
          { type: 'hangup', params: { signal: 'busy', timeout: 10 }, condition: { time_group_uid: 12 } },
        ],
      },
    ]);
    const dp = await service.generateAllVoiceRobotContexts(42);
    expect(dp).toMatch(/ExecIfTime|WT_/);
  });

  it('fallback_action (line 456) happy-path Busy(10) is exact', async () => {
    voiceRobotModel.findAll.mockResolvedValue([
      {
        uid: 9,
        name: 'Bot',
        max_retries_action: [],
        fallback_action: [{ type: 'hangup', params: { signal: 'busy', timeout: 10 }, condition: {} }],
      },
    ]);
    const dp = await service.generateAllVoiceRobotContexts(42);
    expect(dp).toBe(
      [
        '; ===== Voice Robot: Bot (UID: 9) =====',
        '[voicerobot_9]',
        'exten => s,1,NoOp(Starting Voice Robot: Bot)',
        'same => n,Stasis(krasterisk_voicerobots, 9)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "SUCCESS"]?end_robot)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "MAX_RETRIES"]?max_retries)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "MAX_DURATION"]?max_retries)',
        'same => n,Gosub(voicerobot_fallback_9,s,1)',
        'same => n(end_robot),Return()',
        'same => n(max_retries),NoOp(Max retries for Bot)',
        'same => n,Return()',
        '',
        '[voicerobot_fallback_9]',
        'exten => s,1,NoOp(Fallback for Robot: Bot)',
        'same => n,Busy(10)',
        'same => n,Return()',
        '',
      ].join('\n'),
    );
  });

  /**
   * voice-robots.service.ts:479 — keyword.actions without time-group guard.
   * 12-05 must wrap this call site.
   */
  it('vr_keywords action (line 479) emits WT_ guard when time_group_uid is set', async () => {
    voiceRobotModel.findAll.mockResolvedValue([
      {
        uid: 9,
        name: 'Bot',
        max_retries_action: [],
        fallback_action: [],
      },
    ]);
    groupModel.findAll.mockResolvedValue([{ uid: 2, robot_id: 9, active: 1 }]);
    keywordModel.findAll.mockResolvedValue([
      {
        uid: 4,
        keywords: 'help',
        actions: [
          { type: 'toivr', params: { ivr_uid: 7 }, condition: { time_group_uid: 12 } },
        ],
      },
    ]);
    const dp = await service.generateAllVoiceRobotContexts(42);
    expect(dp).toMatch(/ExecIfTime|WT_/);
  });

  it('vr_keywords action (line 479) happy-path Goto(ivr_7) is exact', async () => {
    voiceRobotModel.findAll.mockResolvedValue([
      {
        uid: 9,
        name: 'Bot',
        max_retries_action: [],
        fallback_action: [],
      },
    ]);
    groupModel.findAll.mockResolvedValue([{ uid: 2, robot_id: 9, active: 1 }]);
    keywordModel.findAll.mockResolvedValue([
      {
        uid: 4,
        keywords: 'help',
        actions: [{ type: 'toivr', params: { ivr_uid: 7 }, condition: {} }],
      },
    ]);
    const dp = await service.generateAllVoiceRobotContexts(42);
    expect(dp).toBe(
      [
        '; ===== Voice Robot: Bot (UID: 9) =====',
        '[voicerobot_9]',
        'exten => s,1,NoOp(Starting Voice Robot: Bot)',
        'same => n,Stasis(krasterisk_voicerobots, 9)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "SUCCESS"]?end_robot)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "MAX_RETRIES"]?max_retries)',
        'same => n,GotoIf($["${ROBOT_STATUS}" = "MAX_DURATION"]?max_retries)',
        'same => n,Gosub(voicerobot_fallback_9,s,1)',
        'same => n(end_robot),Return()',
        'same => n(max_retries),NoOp(Max retries for Bot)',
        'same => n,Return()',
        '',
        '[voicerobot_fallback_9]',
        'exten => s,1,NoOp(Fallback for Robot: Bot)',
        'same => n,Return()',
        '',
        '[voicerobot_keyword_4]',
        'exten => s,1,NoOp(Robot Keyword Match: help)',
        'same => n,Set(__KRSK_HOPS=$[${__KRSK_HOPS} + 1])',
        'same => n,GotoIf($[${__KRSK_HOPS} <= 10]?ivr_7,start,1)',
        'same => n,NoOp(KRSK hop limit exceeded route=ivr_7)',
        'same => n,Congestion()',
        'same => n,Return()',
        '',
      ].join('\n'),
    );
  });
});
