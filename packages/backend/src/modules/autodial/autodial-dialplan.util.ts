import { HTTP_RESULT_VAR, type IAutodialAmdConfig, type IRouteAction } from '@krasterisk/shared';
import type { DialplanCategory } from '../ami/dialplan-apply.service';
import { buildCurlCall } from '../../shared/utils/dialplan-curl.util';
import { emitPlayback } from '../../shared/utils/dialplan-playback.util';
import { renderActionChain } from '../../shared/utils/dialplan.util';

/** Chars that would break out of a dialplan application argument. */
const DIALPLAN_UNSAFE = /[(),?[\]{}$\\";\n\r]/g;

export function sanitizeAutodialArg(input: unknown): string {
  return String(input ?? '').replace(DIALPLAN_UNSAFE, '').trim();
}

export function autodialCampaignContextName(campaignUid: number): string {
  return `krsk-ac-${campaignUid}`;
}

/** Legacy shared name. Must not be emitted in per-tenant ac_*.conf files. */
export const AUTODIAL_FINALIZE_CONTEXT = 'krsk-ac-finalize';

export function autodialFinalizeContextName(vpbxUserUid: number): string {
  return `${AUTODIAL_FINALIZE_CONTEXT}-${vpbxUserUid}`;
}

export function autodialConfigFile(vpbxUserUid: number): string {
  return `krasterisk/autodial/ac_${vpbxUserUid}.conf`;
}

export interface AutodialScenarioCampaign {
  uid: number;
  name: string;
  amd: IAutodialAmdConfig;
  queue_names: string[];
  scenario_actions: IRouteAction[];
}

/**
 * Emit the campaign context the dialer hands the answered channel to via ARI
 * `continueInDialplan`. The channel is already answered at this point, so the
 * preamble never calls Answer().
 */
export function generateAutodialCampaignDialplan(
  campaign: AutodialScenarioCampaign,
  vpbxUserUid: number,
): DialplanCategory {
  const name = autodialCampaignContextName(campaign.uid);
  const label = sanitizeAutodialArg(campaign.name) || `campaign ${campaign.uid}`;

  const lines: string[] = [
    `[${name}]`,
    `exten => s,1,NoOp(Autodial campaign ${campaign.uid} ${label})`,
    `same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`,
    `same => n,Set(__KRSK_AC_CAMPAIGN=${campaign.uid})`,
    // ARI sets KRSK_AC_TASK/ATTEMPT before dialing; re-export so Local and
    // queue-member child channels inherit them for the finalize handler.
    'same => n,Set(__KRSK_AC_TASK=${KRSK_AC_TASK})',
    'same => n,Set(__KRSK_AC_ATTEMPT=${KRSK_AC_ATTEMPT})',
    'same => n,Set(__KRSK_AC_ANSWERED=1)',
    `same => n,Set(CHANNEL(hangup_handler_push)=${autodialFinalizeContextName(vpbxUserUid)},s,1)`,
  ];

  if (campaign.amd?.enabled) {
    lines.push(...emitAmdBranch(campaign.amd));
  }

  lines.push(...emitScenario(campaign.scenario_actions, vpbxUserUid));
  lines.push('same => n,Hangup()');

  return { name, lines };
}

/**
 * Stock app_amd. AMDSTATUS is MACHINE / HUMAN / NOTSURE / HANGUP; only MACHINE
 * is treated as a machine so an uncertain result still reaches a human path.
 */
function emitAmdBranch(amd: IAutodialAmdConfig): string[] {
  const lines: string[] = [
    'same => n,AMD()',
    'same => n,Set(__KRSK_AC_AMD=${AMDSTATUS})',
  ];
  if (amd.on_machine === 'hangup' || amd.on_machine === 'voicemail') {
    lines.push('same => n,GotoIf($["${AMDSTATUS}" = "MACHINE"]?ac_machine)');
  }
  return lines;
}

/** Strip an audio extension so Asterisk Playback resolves the format itself. */
export function autodialPromptPlaybackStem(filename: unknown): string {
  const raw = sanitizeAutodialArg(filename);
  return raw.replace(/\.(wav|gsm|ulaw|alaw|sln16|sln|mp3|ogg)$/i, '');
}

/**
 * Trailing label the AMD branch jumps to; appended after the scenario body.
 * Voicemail mode waits briefly for post-greeting silence, plays the configured
 * prompt, then reports outcome=voicemail before Hangup.
 */
function emitMachineTail(
  amd: IAutodialAmdConfig | undefined,
  vpbxUserUid?: number,
): string[] {
  if (!amd?.enabled || amd.on_machine === 'continue') return [];
  const lines = [
    'same => n(ac_machine),NoOp(Autodial: answering machine detected)',
  ];

  const leaveMessage = amd.on_machine === 'voicemail';
  if (leaveMessage) {
    const stem = autodialPromptPlaybackStem(amd.message_prompt);
    if (!stem || vpbxUserUid == null) {
      lines.push('same => n,NoOp(Autodial: voicemail media missing)');
    } else {
      // Prefer a post-greeting silence pocket. WaitForSilence is optional on
      // some Asterisk builds (autoload=no / app not compiled); TryExec then
      // Wait(2) still lets Playback run instead of aborting the tail.
      lines.push('same => n,TryExec(WaitForSilence(300,2,5))');
      lines.push('same => n,ExecIf($["${TRYSTATUS}"!="SUCCESS"]?Wait(2))');
      lines.push(`same => n,Playback(/usr/records/${vpbxUserUid}/sounds/${stem})`);
    }
  }

  // CURL is synchronous in the dialplan. Record this terminal classification
  // before Hangup can emit ARI ChannelDestroyed; otherwise ARI would only see
  // a generic answered call and could advance the task with the wrong result.
  if (vpbxUserUid != null) {
    const curl = buildCurlCall(
      'attempt-machine',
      {
        attempt: '${KRSK_AC_ATTEMPT}',
        outcome: leaveMessage ? 'voicemail' : 'hangup',
      },
      { endpoint: 'internal/autodial/attempt-machine', vpbxUserUid },
    );
    lines.push(`same => n,${curl}`);
  }
  lines.push('same => n,Hangup()');
  return lines;
}

/**
 * Render the DialplanAppsEditor chain. Only the step types meaningful for an
 * outbound dialer are emitted; anything else becomes a NoOp so an unknown step
 * can never silently drop the call.
 */
function emitScenario(actions: IRouteAction[], vpbxUserUid: number): string[] {
  const lines: string[] = [];
  const list = Array.isArray(actions) ? actions : [];

  for (const action of list) {
    if (!action || (action as { enabled?: boolean }).enabled === false) continue;
    const params = (action.params ?? {}) as Record<string, unknown>;

    switch (action.type) {
      case 'playback': {
        const params = { ...(action.params ?? {}) } as Record<string, unknown>;
        if (params.files == null && params.file == null && params.prompt) {
          params.files = params.prompt;
        }
        lines.push(...emitSharedChain({ ...action, params } as IRouteAction, vpbxUserUid));
        break;
      }
      case 'text2speech':
        lines.push(...emitAutodialText2Speech(action, vpbxUserUid, lines.length));
        break;
      case 'toqueue': {
        // Route destination comes only from the scenario step. Campaign
        // queue_names is the pacing agent pool, never a silent Queue() fallback.
        const target = params.target as { source?: unknown; value?: unknown } | undefined;
        const fixedTarget = target?.source === 'fixed' ? target.value : undefined;
        const queue = sanitizeAutodialArg(
          params.queue
            ?? params.queue_name
            ?? fixedTarget
            ?? '',
        );
        if (!queue) {
          throw new Error('AC_SCENARIO_TARGET_UNSUPPORTED: toqueue requires a fixed queue');
        }
        const timeout = Number(params.timeout ?? 0);
        lines.push(`same => n,Set(__KRSK_AC_QUEUE=${queue})`);
        lines.push(
          timeout > 0
            ? `same => n,Queue(${queue},t,,,${timeout})`
            : `same => n,Queue(${queue},t)`,
        );
        break;
      }
      case 'toexten': {
        const target = params.target as { source?: unknown; value?: unknown } | undefined;
        const fixedTarget = target?.source === 'fixed' ? target.value : undefined;
        const exten = sanitizeAutodialArg(
          params.exten
            ?? params.extension
            ?? fixedTarget
            ?? '',
        );
        lines.push(exten ? `same => n,Dial(PJSIP/${exten},60,tT)` : 'same => n,NoOp(Autodial: no exten)');
        break;
      }
      case 'voicerobot': {
        const robotUid = Number(params.robotUid ?? params.robot_uid ?? 0);
        lines.push(
          robotUid > 0
            ? `same => n,Gosub(voicerobot_${robotUid},s,1)`
            : 'same => n,NoOp(Autodial: no voice robot)',
        );
        break;
      }
      case 'ai_voice_robot': {
        const deploymentId = sanitizeAutodialArg(params.deployment_id ?? params.deploymentId ?? '');
        lines.push(
          deploymentId
            ? `same => n,Stasis(krasterisk_ai_voice,${deploymentId},\${KRSK_AC_ATTEMPT})`
            : 'same => n,NoOp(Autodial: no AI voice deployment)',
        );
        break;
      }
      case 'collect_input': {
        const digits = Number(params.digits ?? 1);
        const timeout = Number(params.timeout ?? 5);
        lines.push(`same => n,Read(KRSK_AC_DTMF,,${digits},,,${timeout})`);
        lines.push('same => n,Set(__KRSK_AC_DTMF=${KRSK_AC_DTMF})');
        break;
      }
      case 'label': {
        const labelName = sanitizeAutodialArg(params.name ?? '');
        if (labelName) lines.push(`same => n(${labelName}),NoOp(label ${labelName})`);
        break;
      }
      case 'goto': {
        const target = sanitizeAutodialArg(params.label ?? '');
        if (target) lines.push(`same => n,Goto(${target})`);
        break;
      }
      case 'hangup':
        lines.push('same => n,Hangup()');
        break;
      default:
        lines.push(`same => n,NoOp(Autodial: unsupported step ${sanitizeAutodialArg(action.type)})`);
    }
  }

  if (!lines.length) {
    lines.push('same => n,NoOp(Autodial: empty scenario)');
  }
  return lines;
}

/**
 * Shared TTS sanitizer strips `$`/`{}`, so autodial contact vars never reach
 * CURL. Expand `{AC_NAME}` / `${AC_NAME}` into a Set() that Asterisk interpolates
 * at answer time, then pass that channel var to the TTS endpoint.
 */
const AC_FIELD_TOKEN = /\$\{(AC_[A-Z0-9_]+)\}|\{\{(AC_[A-Z0-9_]+)\}\}|\{(AC_[A-Z0-9_]+)\}/g;

export function autodialTtsHasFieldTokens(text: unknown): boolean {
  AC_FIELD_TOKEN.lastIndex = 0;
  return AC_FIELD_TOKEN.test(String(text ?? ''));
}

export function autodialTtsRuntimeTemplate(text: unknown): { template: string; vars: string[] } {
  const raw = String(text ?? '');
  const vars: string[] = [];
  const parts: string[] = [];
  const re = new RegExp(AC_FIELD_TOKEN.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    parts.push(raw.slice(last, match.index).replace(DIALPLAN_UNSAFE, ''));
    const name = match[1] || match[2] || match[3];
    vars.push(name);
    parts.push(`\${${name}}`);
    last = match.index + match[0].length;
  }
  parts.push(raw.slice(last).replace(DIALPLAN_UNSAFE, ''));
  return { template: parts.join(''), vars: [...new Set(vars)] };
}

function emitAutodialText2Speech(
  action: IRouteAction,
  vpbxUserUid: number,
  stepIndex: number,
): string[] {
  const params = (action.params ?? {}) as Record<string, unknown>;
  if (!autodialTtsHasFieldTokens(params.text)) {
    return emitSharedChain(action, vpbxUserUid);
  }
  const { template, vars } = autodialTtsRuntimeTemplate(params.text);
  const textVar = `KRSK_TTS_TEXT_${stepIndex}`;
  const curl = buildCurlCall(
    'tts',
    {
      text: `\${${textVar}}`,
      engine: sanitizeAutodialArg(params.engine),
    },
    { vpbxUserUid },
  );
  const play = emitPlayback(
    { mode: 'plain', files: `\${${HTTP_RESULT_VAR}}` },
    { vpbxUserUid },
  );
  const lines = [
    `same => n,Set(${textVar}=${template})`,
    ...curl
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (/^(same => n,|exten => |\[)/.test(line) ? line : `same => n,${line}`)),
  ];
  for (const raw of play.split('\n').map((line) => line.trim()).filter(Boolean)) {
    const line = /^(same => n,|exten => |\[)/.test(raw) ? raw : `same => n,${raw}`;
    const playback = /^same => n,Playback\((.+)\)$/.exec(line);
    if (playback) {
      lines.push(
        `same => n,ExecIf($["\${${HTTP_RESULT_VAR}}" != ""]?Playback(${playback[1]}))`,
      );
    } else {
      lines.push(line);
    }
  }
  const numberVar = vars.find((name) => /DEBT|AMOUNT|SUM|TOTAL/.test(name));
  if (numberVar) {
    lines.push(
      `same => n,ExecIf($["\${${HTTP_RESULT_VAR}}" = ""]?SayNumber(\${${numberVar}}))`,
    );
  }
  lines.push(`same => n,ExecIf($["\${${HTTP_RESULT_VAR}}" = ""]?Playback(beep))`);
  return lines;
}

/** Adapter onto the shared action renderer (playback/TTS media prep). */
function emitSharedChain(action: IRouteAction, vpbxUserUid: number): string[] {
  const dp = renderActionChain([action], { vpbxUserUid, host: 'route' });
  if (!dp.trim()) {
    return [`same => n,NoOp(Autodial: empty ${sanitizeAutodialArg(action.type)})`];
  }
  return dp
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/^(same => n,|exten => |\[)/.test(line) ? line : `same => n,${line}`));
}

/** Append the AMD machine tail after the scenario body. */
export function withMachineTail(
  category: DialplanCategory,
  amd: IAutodialAmdConfig | undefined,
  vpbxUserUid?: number,
): DialplanCategory {
  const tail = emitMachineTail(amd, vpbxUserUid);
  if (!tail.length) return category;
  return { name: category.name, lines: [...category.lines, ...tail] };
}

/**
 * Per-tenant finalize handler. A shared `krsk-ac-finalize` name collides when
 * Asterisk loads every `ac_{tenant}.conf`. Runs as a hangup handler so CURL
 * latency never sits in the talk path.
 */
export function generateAutodialFinalizeContext(vpbxUserUid: number): DialplanCategory {
  const name = autodialFinalizeContextName(vpbxUserUid);
  const curl = buildCurlCall(
    'attempt-result',
    {
      task: '${KRSK_AC_TASK}',
      campaign: '${KRSK_AC_CAMPAIGN}',
      attempt: '${KRSK_AC_ATTEMPT}',
      answered: '${KRSK_AC_ANSWERED}',
      billsec: '${CDR(billsec)}',
      duration: '${CDR(duration)}',
      disposition: '${CDR(disposition)}',
      amd: '${KRSK_AC_AMD}',
      queue: '${KRSK_AC_QUEUE}',
      // app_queue sets MEMBERINTERFACE on the caller once a member answers;
      // empty means the subscriber waited and left without an operator.
      agent: '${MEMBERINTERFACE}',
      dtmf: '${KRSK_AC_DTMF}',
      uniqueid: '${UNIQUEID}',
      linkedid: '${LINKEDID}',
    },
    { endpoint: 'internal/autodial/attempt-result', vpbxUserUid },
  );

  return {
    name,
    lines: [
      `[${name}]`,
      'exten => s,1,NoOp(Autodial finalize task=${KRSK_AC_TASK})',
      // Nothing to report for a channel that never belonged to a campaign.
      'same => n,GotoIf($["${KRSK_AC_TASK}" = ""]?ac_done)',
      `same => n,${curl}`,
      'same => n(ac_done),Return()',
    ],
  };
}
