import type { IRouteAction } from '@krasterisk/shared';
import {
  autodialCampaignContextName,
  autodialConfigFile,
  generateAutodialCampaignDialplan,
  generateAutodialFinalizeContext,
  sanitizeAutodialArg,
  withMachineTail,
} from './autodial-dialplan.util';

function campaign(over: Partial<Parameters<typeof generateAutodialCampaignDialplan>[0]> = {}) {
  return {
    uid: 7,
    name: 'Осенняя акция',
    amd: { enabled: false, on_machine: 'hangup' as const },
    queue_names: ['sales'],
    scenario_actions: [] as IRouteAction[],
    ...over,
  };
}

function action(type: string, params: Record<string, unknown> = {}): IRouteAction {
  return { id: `s${type}`, type, params } as unknown as IRouteAction;
}

describe('naming', () => {
  it('derives the context name from the campaign uid', () => {
    expect(autodialCampaignContextName(7)).toBe('krsk-ac-7');
  });

  it('keeps one config file per tenant', () => {
    expect(autodialConfigFile(42)).toBe('krasterisk/autodial/ac_42.conf');
  });
});

describe('sanitizeAutodialArg', () => {
  it('strips characters that would break out of an application argument', () => {
    expect(sanitizeAutodialArg('Hangup()${EVIL},x')).toBe('HangupEVILx');
  });

  it('renders nullish input as an empty string', () => {
    expect(sanitizeAutodialArg(undefined)).toBe('');
  });
});

describe('generateAutodialCampaignDialplan', () => {
  it('uses editor input parameters, tenant prompt and preserves the named variable', () => {
    const { lines } = generateAutodialCampaignDialplan(campaign({ scenario_actions: [
      action('collect_input', { variableName: 'AC_CHOICE', promptFile: 'question.wav', digitsCount: 2, timeout: 10 }),
      action('label', { label_name: 'done' }),
      action('hangup', { causecode: '17' }),
    ] }), 42);
    expect(lines).toContain('same => n,Read(AC_CHOICE,/usr/records/42/sounds/question,2,,1,10)');
    expect(lines).toContain('same => n,Set(__KRSK_AC_DTMF=${AC_CHOICE})');
    expect(lines).toContain('same => n(done),NoOp(label done)');
    expect(lines).toContain('same => n,Hangup(17)');
  });

  it('does not accept channel-variable or prompt path injection', () => {
    for (const params of [{ variableName: 'X)=evil' }, { promptFile: '../other-tenant/sound' }]) {
      expect(() => generateAutodialCampaignDialplan(campaign({ scenario_actions: [action('collect_input', params)] }), 42)).toThrow();
    }
  });
  it('does not answer the channel — ARI hands it over already answered', () => {
    const { lines } = generateAutodialCampaignDialplan(campaign(), 42);
    expect(lines.some((l) => l.includes('Answer()'))).toBe(false);
  });

  it('tags the CDR with the tenant', () => {
    const { lines } = generateAutodialCampaignDialplan(campaign(), 42);
    expect(lines).toContain('same => n,Set(CDR(vpbx_user_uid)=42)');
  });

  it('exports task identity with the inheritance prefix', () => {
    const { lines } = generateAutodialCampaignDialplan(campaign(), 42);
    expect(lines).toContain('same => n,Set(__KRSK_AC_TASK=${KRSK_AC_TASK})');
    expect(lines).toContain('same => n,Set(__KRSK_AC_ATTEMPT=${KRSK_AC_ATTEMPT})');
  });

  it('pushes a per-tenant finalize hangup handler', () => {
    const { lines } = generateAutodialCampaignDialplan(campaign(), 42);
    expect(lines).toContain('same => n,Set(CHANNEL(hangup_handler_push)=krsk-ac-finalize-42,s,1)');
  });

  it('emits a Queue step for toqueue and records the queue name', () => {
    const { lines } = generateAutodialCampaignDialplan(
      campaign({ scenario_actions: [action('toqueue', { queue: 'sales' })] }),
      42,
    );
    expect(lines).toContain('same => n,Set(__KRSK_AC_QUEUE=sales)');
    expect(lines).toContain('same => n,Queue(sales,t)');
  });

  it('uses the fixed queue target from the scenario step', () => {
    const { lines } = generateAutodialCampaignDialplan(
      campaign({
        scenario_actions: [
          action('toqueue', { target: { source: 'fixed', value: 'priority' } }),
        ],
      }),
      42,
    );
    expect(lines).toContain('same => n,Queue(qpriority_42,t)');
    expect(lines.some((l) => l.includes('Queue(sales'))).toBe(false);
  });

  it('scopes playback media to the campaign tenant using the shared renderer', () => {
    const { lines } = generateAutodialCampaignDialplan(
      campaign({ scenario_actions: [action('playback', { file: 'welcome', mode: 'plain' })] }),
      42,
    );
    expect(lines).toContain('same => n,Playback(/usr/records/42/sounds/welcome)');
    expect(lines).not.toContain('same => n,Playback(welcome)');
  });

  it('uses a bounded TTS request and observes playback for plain text too', () => {
    const { lines } = generateAutodialCampaignDialplan(
      campaign({
        scenario_actions: [action('text2speech', { text: 'hello', engine: 3 })],
      }),
      42,
    );
    const body = lines.join('\n');
    expect(body).toMatch(/CURL\(/);
    expect(body).toMatch(/Playback\(/);
    expect(body).toContain('Set(CURLOPT(httptimeout)=30)');
    expect(body).toContain('UserEvent(AutodialStepResult');
  });

  it('interpolates autodial field tokens in TTS instead of stripping them', () => {
    const { lines } = generateAutodialCampaignDialplan(
      campaign({
        scenario_actions: [
          action('text2speech', {
            text: 'Здравствуйте {AC_NAME} ваш долг {AC_DEBT} рублей',
            engine: 3,
          }),
        ],
      }),
      42,
    );
    const body = lines.join('\n');
    expect(body).toMatch(/Set\(KRSK_TTS_TEXT_\d+=Здравствуйте \$\{AC_NAME\} ваш долг \$\{AC_DEBT\} рублей\)/);
    expect(body).toContain('text=${URIENCODE(${KRSK_TTS_TEXT_');
    expect(body).toContain('Playback(/usr/records/42/sounds/${KRSK_HTTP_RESULT})');
    expect(body).toContain('REGEX("^[A-Za-z0-9_-]+$" ${KRSK_HTTP_RESULT})');
    expect(body).not.toContain('SayNumber(');
    expect(body).not.toContain('Playback(beep)');
  });
  it('prepares a real input signal instead of an empty Read prompt and observes READSTATUS', () => {
    const body = generateAutodialCampaignDialplan(campaign({ scenario_actions: [action('collect_input', {
      variableName: 'AC_VISIT', digitsCount: 1, attempts: 2, timeout: 10,
    })] }), 42).lines.join('\n');
    expect(body).toContain('Set(AC_VISIT=)');
    expect(body).toContain('Read(AC_VISIT,/usr/records/42/sounds/krsk_ac_input_signal_v1,1,,2,10)');
    expect(body).toContain('Status: ${READSTATUS},Digits: ${AC_VISIT}');
  });
  it('ends a conversation on a failed TTS step when its explicit policy requires it', () => {
    const body = generateAutodialCampaignDialplan(campaign({ scenario_actions: [action('text2speech', {
      text: 'Customer reminder', engine: 3, onFailure: 'hangup',
    })] }), 42).lines.join('\n');
    expect(body).toContain('ExecIf($["${KRSK_AC_TTS_STATUS}" != "SUCCESS"]?Hangup())');
  });

  it('rejects a toqueue step without a fixed queue instead of using campaign.queue_names', () => {
    expect(() =>
      generateAutodialCampaignDialplan(
        campaign({ scenario_actions: [action('toqueue')] }),
        42,
      ),
    ).toThrow(/AC_SCENARIO_TARGET_UNSUPPORTED/);
  });

  it('skips disabled steps', () => {
    const disabled = { ...action('toqueue', { queue: 'sales' }), enabled: false };
    const { lines } = generateAutodialCampaignDialplan(
      campaign({ scenario_actions: [disabled as unknown as IRouteAction] }),
      42,
    );
    expect(lines.some((l) => l.includes('Queue('))).toBe(false);
  });

  it('renders an unsupported step as a NoOp rather than dropping the call', () => {
    const { lines } = generateAutodialCampaignDialplan(
      campaign({ scenario_actions: [action('totrunk', { trunk: 'x' })] }),
      42,
    );
    expect(lines.some((l) => l.includes('NoOp(Autodial: unsupported step totrunk)'))).toBe(true);
  });

  it('always terminates the context with a hangup', () => {
    const { lines } = generateAutodialCampaignDialplan(campaign(), 42);
    expect(lines[lines.length - 1]).toBe('same => n,Hangup()');
  });

  it('adds an AMD branch only when AMD is enabled', () => {
    const off = generateAutodialCampaignDialplan(campaign(), 42);
    expect(off.lines.some((l) => l.includes('AMD()'))).toBe(false);

    const on = generateAutodialCampaignDialplan(
      campaign({ amd: { enabled: true, on_machine: 'hangup' } }),
      42,
    );
    expect(on.lines).toContain('same => n,AMD()');
    expect(on.lines).toContain('same => n,GotoIf($["${AMDSTATUS}" = "MACHINE"]?ac_machine)');
  });
});

describe('withMachineTail', () => {
  it('appends the machine label the AMD branch jumps to', () => {
    const amd = { enabled: true, on_machine: 'hangup' as const };
    const category = withMachineTail(
      generateAutodialCampaignDialplan(campaign({ amd }), 42),
      amd,
      42,
    );
    expect(category.lines).toContain(
      'same => n(ac_machine),NoOp(Autodial: answering machine detected)',
    );
    expect(category.lines.join('\n')).toContain('internal/autodial/attempt-machine');
    expect(category.lines.join('\n')).toContain('attempt=${URIENCODE(${KRSK_AC_ATTEMPT})}');
    expect(category.lines.every((line) => !/[\r\n]/.test(line))).toBe(true);
    expect(category.lines.some((line) => line.startsWith('same => n,Set(KRSK_HTTP_RESULT=${CURL('))).toBe(true);
  });

  it('plays the configured prompt in the machine tail for voicemail mode', () => {
    const amd = {
      enabled: true,
      on_machine: 'voicemail' as const,
      message_prompt: 'amd-leave.wav',
    };
    const category = withMachineTail(
      generateAutodialCampaignDialplan(campaign({ amd }), 42),
      amd,
      42,
    );
    const body = category.lines.join('\n');
    expect(body).toContain('TryExec(WaitForSilence(300,2,5))');
    expect(body).toContain('ExecIf($["${TRYSTATUS}"!="SUCCESS"]?Wait(2))');
    expect(body).toContain('Playback(/usr/records/42/sounds/amd-leave)');
    expect(body).toContain('outcome=voicemail');
    expect(body).toContain('internal/autodial/attempt-machine');
  });

  it('adds nothing when AMD continues on machine', () => {
    const amd = { enabled: true, on_machine: 'continue' as const };
    const base = generateAutodialCampaignDialplan(campaign({ amd }), 42);
    expect(withMachineTail(base, amd).lines).toEqual(base.lines);
  });

  it('adds nothing when AMD is off', () => {
    const amd = { enabled: false, on_machine: 'hangup' as const };
    const base = generateAutodialCampaignDialplan(campaign({ amd }), 42);
    expect(withMachineTail(base, amd).lines).toEqual(base.lines);
  });
});

describe('generateAutodialFinalizeContext', () => {
  it('is a per-tenant subroutine so two tenant files can load together', () => {
    const a = generateAutodialFinalizeContext(42);
    const b = generateAutodialFinalizeContext(2);
    expect(a.name).toBe('krsk-ac-finalize-42');
    expect(b.name).toBe('krsk-ac-finalize-2');
    expect(a.name).not.toBe(b.name);
    expect(a.lines[0]).toBe('[krsk-ac-finalize-42]');
    expect(a.lines[a.lines.length - 1]).toBe('same => n(ac_done),Return()');
  });

  it('short-circuits for channels that never belonged to a campaign', () => {
    const { lines } = generateAutodialFinalizeContext(42);
    expect(lines).toContain('same => n,GotoIf($["${KRSK_AC_TASK}" = ""]?ac_done)');
  });

  it('reports the post-answer facts ARI cannot see', () => {
    const { lines } = generateAutodialFinalizeContext(42);
    expect(lines.every((line) => !/[\r\n]/.test(line))).toBe(true);
    expect(lines.some((line) => line.startsWith('same => n,Set(KRSK_HTTP_RESULT=${CURL('))).toBe(true);
    const body = lines.join('\n');
    expect(body).toContain('billsec=');
    expect(body).toContain('queue=');
    expect(body).toContain('amd=');
    expect(body).toContain('agent=');
    expect(body).toContain('internal/autodial/attempt-result');
  });
});
