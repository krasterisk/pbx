import type { IAutodialAmdConfig, IRouteAction } from '@krasterisk/shared';
import type { DialplanCategory } from '../ami/dialplan-apply.service';
import { buildCurlCall } from '../../shared/utils/dialplan-curl.util';
import { emitPlayback } from '../../shared/utils/dialplan-playback.util';

/** Chars that would break out of a dialplan application argument. */
const DIALPLAN_UNSAFE = /[(),?[\]{}$\\";\n\r]/g;

export function sanitizeAutodialArg(input: unknown): string {
  return String(input ?? '').replace(DIALPLAN_UNSAFE, '').trim();
}

export function autodialCampaignContextName(campaignUid: number): string {
  return `krsk-ac-${campaignUid}`;
}

export const AUTODIAL_FINALIZE_CONTEXT = 'krsk-ac-finalize';

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
    `same => n,Set(CHANNEL(hangup_handler_push)=${AUTODIAL_FINALIZE_CONTEXT},s,1)`,
  ];

  if (campaign.amd?.enabled) {
    lines.push(...emitAmdBranch(campaign.amd));
  }

  lines.push(...emitScenario(campaign.scenario_actions, campaign.queue_names, vpbxUserUid));
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
  if (amd.on_machine === 'hangup') {
    lines.push('same => n,GotoIf($["${AMDSTATUS}" = "MACHINE"]?ac_machine)');
  } else if (amd.on_machine === 'voicemail') {
    lines.push('same => n,GotoIf($["${AMDSTATUS}" = "MACHINE"]?ac_machine)');
  }
  return lines;
}

/** Trailing label the AMD branch jumps to; appended after the scenario body. */
function emitMachineTail(
  amd: IAutodialAmdConfig | undefined,
  vpbxUserUid?: number,
): string[] {
  if (!amd?.enabled || amd.on_machine === 'continue') return [];
  const lines = [
    'same => n(ac_machine),NoOp(Autodial: answering machine detected)',
  ];
  // CURL is synchronous in the dialplan. Record this terminal classification
  // before Hangup can emit ARI ChannelDestroyed; otherwise ARI would only see
  // a generic answered call and could advance the task with the wrong result.
  if (vpbxUserUid != null) {
    const curl = buildCurlCall(
      'attempt-machine',
      { attempt: '${KRSK_AC_ATTEMPT}' },
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
function emitScenario(actions: IRouteAction[], queueNames: string[], vpbxUserUid: number): string[] {
  const lines: string[] = [];
  const list = Array.isArray(actions) ? actions : [];

  for (const action of list) {
    if (!action || (action as { enabled?: boolean }).enabled === false) continue;
    const params = (action.params ?? {}) as Record<string, unknown>;

    switch (action.type) {
      case 'playback': {
        const files = params.files ?? params.file ?? params.prompt ?? '';
        const hasFile = Array.isArray(files)
          ? files.some((file) => String(file ?? '').trim())
          : Boolean(String(files).trim());
        if (!hasFile) {
          lines.push('same => n,NoOp(Autodial: empty playback)');
          break;
        }
        const playback = emitPlayback(
          { ...params, files } as Parameters<typeof emitPlayback>[0],
          { vpbxUserUid },
        );
        lines.push(...playback.split('\nsame => n,').map((app) => `same => n,${app}`));
        break;
      }
      case 'text2speech': {
        const text = sanitizeAutodialArg(params.text ?? '');
        lines.push(
          text
            ? `same => n,Playback(\${KRSK_TTS_${sanitizeAutodialArg(action.id).slice(0, 16) || 'STEP'}})`
            : 'same => n,NoOp(Autodial: empty tts)',
        );
        break;
      }
      case 'toqueue': {
        const target = params.target as { source?: unknown; value?: unknown } | undefined;
        const fixedTarget = target?.source === 'fixed' ? target.value : undefined;
        const queue = sanitizeAutodialArg(
          params.queue
            ?? params.queue_name
            ?? fixedTarget
            ?? queueNames[0]
            ?? '',
        );
        const timeout = Number(params.timeout ?? 0);
        if (queue) {
          lines.push(`same => n,Set(__KRSK_AC_QUEUE=${queue})`);
          lines.push(
            timeout > 0
              ? `same => n,Queue(${queue},t,,,${timeout})`
              : `same => n,Queue(${queue},t)`,
          );
        } else {
          lines.push('same => n,NoOp(Autodial: no queue configured)');
        }
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
 * Tenant-independent finalize handler. Runs as a hangup handler so the CURL
 * latency never sits in the talk path. Reports the outcome the ARI layer cannot
 * see: billsec, AMD result, which queue/agent handled the call, DTMF.
 */
export function generateAutodialFinalizeContext(vpbxUserUid: number): DialplanCategory {
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
    name: AUTODIAL_FINALIZE_CONTEXT,
    lines: [
      `[${AUTODIAL_FINALIZE_CONTEXT}]`,
      'exten => s,1,NoOp(Autodial finalize task=${KRSK_AC_TASK})',
      // Nothing to report for a channel that never belonged to a campaign.
      'same => n,GotoIf($["${KRSK_AC_TASK}" = ""]?ac_done)',
      `same => n,${curl}`,
      'same => n(ac_done),Return()',
    ],
  };
}
