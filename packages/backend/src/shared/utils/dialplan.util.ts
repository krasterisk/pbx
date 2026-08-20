import { DIALPLAN_ACTION_META, HTTP_RESULT_VAR, type ActionType } from '@krasterisk/shared';
import { ActionLog } from '../../modules/logger/action-log.model';
import { normalizeTarget, resolveQueueValueSource, resolveValueSource, PHONEBOOK_TARGET_VAR } from './dialplan-target.util';
import { applyNumberManipulation } from './dialplan-number.util';
import { buildConditionExpr, isLegacyInvalidDialstatus, wrapEachLine } from './dialplan-condition.util';
import { emitHopPrologue } from './dialplan-hops.util';
import { emitPlayback } from './dialplan-playback.util';
import { buildCurlCall } from './dialplan-curl.util';
import { buildTrunkCarousel } from './dialplan-trunk-carousel.util';

function logCmdApply(action: { id?: number; uid?: number; params?: { command?: string } }, vpbxUserUid: number): void {
  const command = String(action?.params?.command ?? '');
  const actionId = typeof action?.id === 'number' ? action.id : typeof action?.uid === 'number' ? action.uid : null;
  const details = JSON.stringify({
    actionId,
    type: 'cmd',
    command: command.slice(0, 80),
  });
  void ActionLog.create({
    user_id: 0,
    action: 'cmd_apply',
    entity_type: 'dialplan_action',
    entity_id: actionId,
    user_uid: vpbxUserUid,
    details,
    status: 'success',
  }).catch(() => undefined);
}

export class AsteriskDialplanUtils {
  /**
   * Base URL of the Krasterisk backend API **as seen from Asterisk**.
   * Configured via DIALPLAN_BACKEND_URL env variable.
   * Must be reachable from the Asterisk server (may differ from localhost).
   *
   * Examples:
   *   - Same server:  http://127.0.0.1:5010/api
   *   - Remote:       https://pbx-backend.example.com/api
   */
  static backendBaseUrl =
    process.env.DIALPLAN_BACKEND_URL
    || `http://127.0.0.1:${process.env.BACKEND_PORT || 5010}/api`;

  /** API key for internal dialplan requests (matches DIALPLAN_API_KEY env) */
  static dialplanApiKey = process.env.DIALPLAN_API_KEY || '';
  /**
   * Sanitize input to prevent OS shell injection.
   * Strips: ; | & $ ` \ " ' \n \r
   * Use for params that previously ended up in host command execution.
   */
  static sanitizeShellInput(input?: string): string {
    if (!input) return '';
    return input.replace(/[;|&$`\\"'\n\r]/g, '').trim();
  }

  /**
   * Sanitize input to prevent Asterisk dialplan injection.
   * Strips: ( ) , ? [ ] { } $ \ " \n \r ;
   * Use for params that end up inside dialplan expressions (Dial, Set, Goto, etc).
   */
  static sanitizeDialplanInput(input?: string): string {
    if (!input) return '';
    return input.replace(/[(),?\[\]{}\$\\";\n\r]/g, '').trim();
  }

  /**
   * Build PJSIP Dial() target for an internal extension.
   * When webrtc is true (default), forks primary + companion so desk phone and browser ring together.
   * Missing companion yields CHANUNAVAIL on that leg; Dial continues on the other.
   *
   * @param extenExpr literal extension ("110") or dialplan expr ("${EXTEN}", "${DIALTO}") — already sanitized
   */
  static pjsipDialTarget(
    extenExpr: string,
    vpbxUserUid: number,
    opts?: { webrtc?: boolean },
  ): string {
    const primary = `PJSIP/e${extenExpr}_${vpbxUserUid}`;
    if (opts?.webrtc === false) return primary;
    return `${primary}&PJSIP/ew${extenExpr}_${vpbxUserUid}`;
  }

  /**
   * Sanitize file path to prevent path traversal.
   * Strips: / \ .. and null bytes.
   * Use for params that reference sound/prompt files.
   */
  static sanitizeFilePath(input?: string): string {
    if (!input) return '';
    return input
      .replace(/\.\./g, '')    // remove directory traversal
      .replace(/[\/\\]/g, '')  // remove path separators
      .replace(/\0/g, '')      // remove null bytes
      .trim();
  }

  /**
   * Sanitize template text that may contain ${VAR} Asterisk channel variables.
   * Used for sendmail subject/text where users can embed dialplan variables.
   *
   * Allows:  ${CALLERID(num)}, ${EXTEN}, ${STRFTIME(...)}, ${CDR(...)}, etc.
   * Blocks host-exec Asterisk functions (shell / system / agi / trysystem).
   * Strips:  \n, \r (prevent dialplan line injection)
   *          ;  (prevent dialplan comment injection)
   *          \  (prevent escape sequences)
   */
  static sanitizeTemplate(input?: string): string {
    if (!input) return '';
    return input
      // 1. Strip newlines — each Set() must be a single dialplan line
      .replace(/[\n\r]/g, ' ')
      // 2. Strip semicolons — prevent dialplan comments that truncate the line
      .replace(/;/g, '')
      // 3. Strip backslashes — prevent escape sequences
      .replace(/\\/g, '')
      // 4. Block dangerous Asterisk functions that execute OS commands
      //    Case-insensitive block of host-exec Asterisk functions.
      .replace(/\$\{\s*(SHELL|SYSTEM|AGI|TrySystem)\s*\(/gi, '${BLOCKED_')
      .trim();
  }

  /** Convert a single JSON action to dialplan text.
   *
   * @param action   - Action descriptor from route.actions JSON
   * @param vpbxUserUid - Tenant ID
   * @param isAdmin  - Allow admin-only actions (cmd)
   * @param wh       - Route webhooks config (optional); used to inject U()/gosub for on_answer
   */
  static actionToDialplan(
    action: any,
    vpbxUserUid: number,
    isAdmin: boolean = false,
    wh: Record<string, any> = {},
  ): string {
    const { type, params = {}, condition = {} } = action;
    let dp = '';

    // Legacy single-string invalid → NoOp warning (preserves prior behavior)
    const invalidStatus = isLegacyInvalidDialstatus(condition);
    if (invalidStatus) {
      return `NoOp(Invalid dialstatus: ${this.sanitizeDialplanInput(invalidStatus)})`;
    }

    switch (type) {
      case 'totrunk': {
        const destSrc = resolveValueSource(params, 'dest');
        let dest = destSrc.source === 'fixed'
          ? applyNumberManipulation(this.sanitizeDialplanInput(destSrc.value), params.numberManipulation)
          : destSrc.source === 'variable'
            ? `\${${this.sanitizeDialplanInput(destSrc.name)}}`
            : destSrc.source === 'phonebook'
              ? `\${${PHONEBOOK_TARGET_VAR}}`
              : '${EXTEN}';
        if (!dest) dest = '${EXTEN}';
        const trunk = this.sanitizeDialplanInput(params.trunk) || '';
        const timeout = parseInt(params.timeout, 10) || 60;
        // Inject U(krsk-on-answer) when on_answer webhook is configured
        // 'dial' arg tells the subroutine which source triggered it
        const dialOpts = this.buildDialOptions(params.options || 'tT', wh);
        const dialLines: string[] = [];
        // DIALTO: attempt responsible employee first (if custom webhook returned a number)
        if (wh.custom?.url) {
          dialLines.push(`ExecIf($["\${DIALTO}" != ""]?Dial(${trunk}/\${DIALTO},15,${dialOpts}))`);
          dialLines.push(`ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return())`);
        }
        dialLines.push(`Dial(${trunk}/${dest},${timeout},${dialOpts})`);
        dp = dialLines.join('\nsame => n,');
        break;
      }
      case 'toexten': {
        const timeout = parseInt(params.timeout, 10) || 30;
        const dialOpts = this.buildDialOptions(params.options || 'tThH', wh);
        const webrtc = params.webrtc !== false && params.webrtc !== 'false';
        const hasTarget = !!(params.target && typeof params.target === 'object')
          || !!params.useExten
          || !!(typeof params.exten === 'string' && params.exten);
        if (!hasTarget) {
          dp = 'NoOp(Missing toexten target)';
          break;
        }
        const src = resolveValueSource(params, 'target', { stringField: 'exten', useExtenField: 'useExten' });
        let dialTarget: string;
        if (src.source === 'fixed' && this.sanitizeDialplanInput(src.value).includes('/')) {
          dialTarget = this.sanitizeDialplanInput(src.value);
        } else if (src.source === 'fixed') {
          const manipulated = applyNumberManipulation(this.sanitizeDialplanInput(src.value), params.numberManipulation);
          if (!manipulated) {
            dp = 'NoOp(Missing toexten target)';
            break;
          }
          dialTarget = normalizeTarget('exten', { source: 'fixed', value: manipulated }, vpbxUserUid, { webrtc });
        } else {
          dialTarget = normalizeTarget('exten', src, vpbxUserUid, { webrtc });
        }
        const dialLines: string[] = [];
        // DIALTO: attempt responsible employee first (if custom webhook returned a number)
        if (wh.custom?.url) {
          const dialToTarget = this.pjsipDialTarget('${DIALTO}', vpbxUserUid, { webrtc: true });
          dialLines.push(`ExecIf($["\${DIALTO}" != ""]?Dial(${dialToTarget},15,${dialOpts}))`);
          dialLines.push(`ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return())`);
        }
        dialLines.push(`Dial(${dialTarget},${timeout},${dialOpts})`);
        dp = dialLines.join('\nsame => n,');
        break;
      }
      case 'toqueue': {
        const src = resolveQueueValueSource(params);
        const timeout = params.timeout ? parseInt(params.timeout, 10) : '';
        const options = this.sanitizeDialplanInput(params.options) || 'thH';
        const announce = this.sanitizeFilePath(String(params.announceoverride ?? ''));
        const prioRaw = parseInt(String(params.priority ?? ''), 10);
        const prio = Number.isFinite(prioRaw) && String(params.priority ?? '') !== '' ? prioRaw : undefined;
        const prioLine = prio !== undefined ? `Set(QUEUE_PRIO=${prio})` : '';
        // Queue on_answer: Asterisk docs confirm gosub runs on the AGENT's channel, not caller's.
        // Variable bridging from caller → agent channel is limited.
        // on_answer for Queue is handled by AMI AgentConnect event in ami.service.ts.
        // We still pass gosub param to capture MEMBERINTERFACE for the AMI handler to correlate.
        // Queue(name,options,URL,announceoverride,timeout,AGI,gosub,...)
        // D-32: QUEUE_PRIO must be set BEFORE Queue() or it has no effect.
        if (src.source === 'phonebook') {
          const pbUid = this.sanitizeDialplanInput(String(src.phonebookUid ?? ''));
          const varKey = this.sanitizeDialplanInput(String(src.varKey ?? ''));
          if (!pbUid || !varKey) {
            dp = `NoOp(Missing phonebook queue target)`;
            break;
          }
          const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';
          const lookupUrl =
            `${this.backendBaseUrl}/internal/dialplan/phonebook-lookup` +
            `?phonebook_uid=${pbUid}&var_key=${encodeURIComponent(varKey)}${keyParam}`;
          const queue = normalizeTarget('queue', src, vpbxUserUid);
          const lines = [
            `Set(${PHONEBOOK_TARGET_VAR}=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`,
          ];
          if (prioLine) lines.push(prioLine);
          lines.push(
            `ExecIf($["\${${PHONEBOOK_TARGET_VAR}}" != ""]?Queue(${queue},${options},,${announce},${timeout}))`,
          );
          dp = lines.join('\nsame => n,');
        } else {
          const queue = normalizeTarget('queue', src, vpbxUserUid);
          const lines = prioLine ? [prioLine] : [];
          lines.push(`Queue(${queue},${options},,${announce},${timeout})`);
          dp = lines.join('\nsame => n,');
        }
        break;
      }
      case 'toivr': {
        const ivrUid = parseInt(params.ivr_uid, 10);
        dp = ivrUid
          ? emitHopPrologue(`ivr_${ivrUid},start,1`, { routeId: `ivr_${ivrUid}` })
          : `NoOp(Missing IVR UID)`;
        break;
      }
      case 'togroup': {
        const src = resolveValueSource(params, 'target', { stringField: 'group' });
        const groupSrc = src.source === 'fixed' && params.numberManipulation
          ? {
            source: 'fixed' as const,
            value: applyNumberManipulation(this.sanitizeDialplanInput(src.value), params.numberManipulation),
          }
          : src;
        dp = `Gosub(${normalizeTarget('group', groupSrc, vpbxUserUid)},start,1)`;
        break;
      }
      case 'voicerobot': {
        const robotUid = parseInt(params.robot_uid, 10);
        dp = robotUid
          ? `Stasis(krasterisk_voicerobots,${robotUid})`
          : `NoOp(Missing Robot UID)`;
        break;
      }
      case 'tolist': {
        const numbers = (params.numbers || '').split(',')
          .map((n: string) => this.sanitizeDialplanInput(n.trim()))
          .filter(Boolean)
          .map((n: string) => `LOCAL/${n}@ctx-${vpbxUserUid}`)
          .join('&');
        const timeout = parseInt(params.timeout, 10) || 30;
        const dialOpts = this.buildDialOptions(params.options || 'tT', wh);
        dp = numbers
          ? `Dial(${numbers},${timeout},${dialOpts})`
          : `NoOp(Empty dial list)`;
        break;
      }
      case 'toroute': {
        const ctx = normalizeTarget(
          'context',
          { source: 'fixed', value: this.sanitizeDialplanInput(params.context) || 'sip-in' },
          vpbxUserUid,
        );
        const destSrc = resolveValueSource(params, 'extension');
        const dest = destSrc.source === 'fixed'
          ? (this.sanitizeDialplanInput(destSrc.value) || '${EXTEN}')
          : destSrc.source === 'variable'
            ? `\${${this.sanitizeDialplanInput(destSrc.name)}}`
            : destSrc.source === 'phonebook'
              ? `\${${PHONEBOOK_TARGET_VAR}}`
              : '${EXTEN}';
        dp = emitHopPrologue(`${ctx},${dest},1`, { routeId: ctx });
        break;
      }
      case 'playback':
        dp = emitPlayback(params, { vpbxUserUid });
        break;
      case 'setclid_custom': {
        const callerid = this.sanitizeDialplanInput(params.callerid);
        const name = this.sanitizeDialplanInput(params.name);
        const lines = [`Set(CALLERID(num)=${callerid})`];
        if (name) lines.push(`Set(CALLERID(name)=${name})`);
        dp = lines.join('\nsame => n,');
        break;
      }
      case 'setclid_list': {
        const listUid = this.sanitizeDialplanInput(String(params.list_uid || ''));
        dp = this.emitSetclidCurl(listUid, vpbxUserUid);
        break;
      }
      case 'voicemail': {
        const vmExten = this.sanitizeDialplanInput(params.exten) || '${EXTEN}';
        dp = `VoiceMail(${vmExten}@default,u)`;
        break;
      }
      case 'text2speech': {
        const curl = buildCurlCall('tts', {
          text: this.sanitizeDialplanInput(params.text),
          engine: this.sanitizeDialplanInput(String(params.engine ?? '')),
          voice: this.sanitizeDialplanInput(params.voice),
          language: this.sanitizeDialplanInput(params.language),
        }, this.curlCtx(vpbxUserUid));
        const play = emitPlayback(
          { mode: 'plain', files: `\${${HTTP_RESULT_VAR}}` },
          { vpbxUserUid },
        );
        dp = `${curl}\nsame => n,${play}`;
        break;
      }
      case 'webhook':
        dp = buildCurlCall('webhook', {
          url: String(params.url ?? '').replace(/[\n\r"'\\]/g, ''),
          clid: '${CALLERID(num)}',
          exten: '${EXTEN}',
          uniqueid: '${UNIQUEID}',
        }, this.curlCtx(vpbxUserUid));
        break;
      case 'confbridge': {
        // Room stays without a tenant suffix (accepted risk T-12-03-05 / T-12-13-03).
        const roomSrc = resolveValueSource(params, 'room');
        const room = roomSrc.source === 'fixed'
          ? (this.sanitizeDialplanInput(roomSrc.value) || '${EXTEN}')
          : roomSrc.source === 'variable'
            ? `\${${this.sanitizeDialplanInput(roomSrc.name)}}`
            : roomSrc.source === 'phonebook'
              ? `\${${PHONEBOOK_TARGET_VAR}}`
              : '${EXTEN}';
        const roomOpts = this.sanitizeDialplanInput(params.options);
        dp = roomOpts ? `ConfBridge(${room},${roomOpts})` : `ConfBridge(${room})`;
        break;
      }
      case 'cmd':
        if (!isAdmin) {
          dp = `NoOp(Unauthorized cmd action)`;
        } else {
          const cleanCmd = (params.command || '').replace(/[\n\r]/g, '');
          dp = `${cleanCmd || 'NoOp()'}`;
          logCmdApply(action, vpbxUserUid);
        }
        break;
      case 'label':
        dp = `NoOp()`; // labels are handled as priority labels
        break;
      case 'busy':
        dp = `Busy(${parseInt(params.timeout, 10) || 10})`;
        break;
      case 'congestion': {
        const timeout = parseInt(params.timeout, 10);
        dp = timeout ? `Congestion(${timeout})` : 'Congestion()';
        break;
      }
      case 'notify':
        dp = this.emitNotifyDialplan(params, vpbxUserUid);
        break;
      case 'callerid': {
        // D-14: unified CallerID — static / phonebook / setclid_list / carousel
        const mode = params.mode || 'static';
        if (mode === 'static') {
          const callerid = this.sanitizeDialplanInput(params.callerid);
          const name = this.sanitizeDialplanInput(params.name);
          const lines = [`Set(CALLERID(num)=${callerid})`];
          if (name) lines.push(`Set(CALLERID(name)=${name})`);
          dp = lines.join('\nsame => n,');
        } else if (mode === 'phonebook') {
          const pbUid = this.sanitizeDialplanInput(String(params.phonebook_uid ?? ''));
          const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';
          const lookupUrl = `${this.backendBaseUrl}/internal/dialplan/phonebook-lookup?phonebook_uid=${pbUid}${keyParam}`;
          const lines = [
            `Set(PB_RAW=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`,
            `ExecIf($["\${CUT(PB_RAW,|,1)}" = "1"]?Set(CALLERID(num)=\${CUT(PB_RAW,|,3)}))`,
            `ExecIf($["\${CUT(PB_RAW,|,1)}" = "1"]?Set(CALLERID(name)=\${CUT(PB_RAW,|,5)}))`,
          ];
          dp = lines.join('\nsame => n,');
        } else if (mode === 'setclid_list') {
          const listUid = this.sanitizeDialplanInput(String(params.list_uid || ''));
          dp = this.emitSetclidCurl(listUid, vpbxUserUid);
        } else if (mode === 'carousel') {
          const pool = (Array.isArray(params.pool) ? params.pool : [])
            .map((c: string) => this.sanitizeDialplanInput(c))
            .filter(Boolean);
          if (!pool.length) {
            dp = `NoOp(Empty CID carousel pool)`;
          } else {
            const lines = pool.map((cid: string, i: number) =>
              i === 0
                ? `Set(CID_1=${cid})`
                : `Set(CID_${i + 1}=${cid})`,
            );
            // D-37: skip the same CID twice in a row (CID_LAST from the previous pick).
            lines.push(`Set(CID_PICK=\${RAND(1,${pool.length})})`);
            lines.push(
              `ExecIf($["\${CID_\${CID_PICK}}" = "\${CID_LAST}"]?Set(CID_PICK=$[\${CID_PICK} % ${pool.length} + 1]))`,
            );
            lines.push(`Set(CALLERID(num)=\${CID_\${CID_PICK}})`);
            lines.push(`Set(__CID_LAST=\${CALLERID(num)})`);
            dp = lines.join('\nsame => n,');
          }
        } else {
          dp = `NoOp(Unknown callerid mode)`;
        }
        break;
      }
      case 'trunk_carousel': {
        // D-36: linear Dial loop; mode from params is real (not forced)
        const trunks: Array<{
          trunk?: string;
          cid_mode?: string;
          callerid?: string;
          phonebook_uid?: number;
          timeout?: number | string;
        }> = Array.isArray(params.trunks) ? params.trunks : [];
        dp = buildTrunkCarousel(
          trunks.map((item) => ({
            trunk: String(item.trunk ?? ''),
            cid_mode: item.cid_mode === 'phonebook' ? 'phonebook' : 'static',
            callerid: item.callerid,
            phonebook_uid: item.phonebook_uid,
            timeout: item.timeout,
          })),
          {
            mode: params.mode,
            timeout: params.timeout,
            options: params.options,
            backendBaseUrl: this.backendBaseUrl,
            dialplanApiKey: this.dialplanApiKey,
            vpbxUserUid,
          },
        );
        break;
      }
      case 'hangup': {
        const causecode = this.sanitizeDialplanInput(params.causecode);
        dp = causecode
          ? `Hangup(${causecode})`
          : `Hangup()`;
        break;
      }
      default:
        dp = `NoOp(Unknown action: ${this.sanitizeDialplanInput(type)})`;
    }

    // D-43: condition wraps every line; branches must not concatenate ExecIf themselves.
    return wrapEachLine(buildConditionExpr(action.condition), dp);
  }

  private static curlCtx(vpbxUserUid: number) {
    return {
      baseUrl: this.backendBaseUrl,
      apiKey: this.dialplanApiKey,
      vpbxUserUid,
    };
  }

  private static emitNotifyDialplan(params: Record<string, any>, vpbxUserUid: number): string {
    const message = this.sanitizeTemplate(params.body ?? params.message ?? params.text ?? '');
    const subject = this.sanitizeTemplate(params.subject ?? '');
    const recipients = params.recipients && typeof params.recipients === 'object' && !Array.isArray(params.recipients)
      ? params.recipients as Record<string, string>
      : {};
    const channels: string[] = Array.isArray(params.channels)
      ? params.channels.map(String)
      : params.channels
        ? String(params.channels).split(',').map((item: string) => item.trim()).filter(Boolean)
        : [];
    let target = this.sanitizeTemplate(params.target ?? '');
    if (!target) {
      target = this.sanitizeTemplate(
        recipients.email
        ?? recipients.telegram
        ?? recipients.whatsapp
        ?? recipients.max
        ?? recipients.vk
        ?? '',
      );
    }
    const payload: Record<string, string> = {
      message: '${KNOTIFY_MSG}',
      target: '${KNOTIFY_TARGET}',
      subject: '${KNOTIFY_SUBJ}',
      clid: '${CALLERID(num)}',
      exten: '${EXTEN}',
      uniqueid: '${UNIQUEID}',
    };
    if (params.integration_uid) {
      payload.integration_uid = this.sanitizeDialplanInput(String(params.integration_uid));
    }
    if (channels.length) {
      payload.channels = channels.join(',');
    }
    if (Object.keys(recipients).length) {
      const safeRecipients: Record<string, string> = {};
      for (const [key, value] of Object.entries(recipients)) {
        safeRecipients[key] = this.sanitizeTemplate(String(value ?? ''));
      }
      payload.recipients = JSON.stringify(safeRecipients);
    }
    const curl = buildCurlCall('notify', payload, this.curlCtx(vpbxUserUid));
    return [
      `Set(__KNOTIFY_MSG=${message})`,
      `Set(__KNOTIFY_TARGET=${target})`,
      `Set(__KNOTIFY_SUBJ=${subject})`,
      curl,
    ].join('\nsame => n,');
  }

  private static emitSetclidCurl(listUid: string, vpbxUserUid: number): string {
    const curl = buildCurlCall('setclid', {
      list_uid: listUid,
      clidnum: '${CLIDNUM}',
    }, this.curlCtx(vpbxUserUid));
    return `${curl}\nsame => n,ExecIf($["\${${HTTP_RESULT_VAR}}" != ""]?Set(CALLERID(num)=\${${HTTP_RESULT_VAR}}))`;
  }

  /**
   * Build Dial() options string, injecting U(krsk-on-answer,s,1(dial)) when on_answer webhook is set.
   *
   * The subroutine runs on the CALLER channel immediately when the called party answers,
   * giving access to all caller-side variables: CALLERID(num), UNIQUEID, __HH_ROUTE_UID, etc.
   *
   * @see https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Dialplan_Applications/Dial — U() option
   */
  private static buildDialOptions(baseOptions: string, wh: Record<string, any>): string {
    const sanitized = this.sanitizeDialplanInput(baseOptions);
    if (!wh.on_answer?.url) return sanitized;
    // Strip any existing U() from user-supplied options to prevent duplicates
    const stripped = sanitized.replace(/U\([^)]*\)/g, '');
    return `${stripped}U(krsk-on-answer,s,1(dial))`;
  }
}

/**
 * D-53: digit-exit is a control transfer, not linear continuation.
 * Emits GotoIf only — never an unconditional Goto to the same dest.
 */
export function emitDigitExitTransition(digit: string, dest: string): string {
  const safeDigit = String(digit ?? '').replace(/[^0-9*#A-D]/g, '');
  const safeDest = String(dest ?? '').replace(/[?\[\]{}$\\";\n\r]/g, '').trim();
  return `GotoIf($["\${EXTEN}" = "${safeDigit}"]?${safeDest})`;
}

/**
 * D-53 / D-24: indices after the first `terminal === 'always'` step.
 * `conditional` (digit-exit playback) does NOT cut reachability.
 */
export function findUnreachableSteps(actions: Array<{ type: string }>): number[] {
  const cut = actions.findIndex((action) => {
    const meta = DIALPLAN_ACTION_META[action.type as ActionType];
    return meta?.terminal === 'always';
  });
  if (cut === -1) return [];
  return actions.map((_, i) => i).filter((i) => i > cut);
}

export type ActionChainHost = 'route' | 'ivr' | 'phonebook' | 'robot';

export interface RenderActionChainCtx {
  vpbxUserUid: number;
  timeGroup?: string;
  host: ActionChainHost;
  isAdmin?: boolean;
  wh?: Record<string, any>;
}

/**
 * D-42: single production path for action chains.
 * Order is fixed: step condition (inner, via actionToDialplan) then time-group (outer).
 */
export function renderActionChain(
  actions: any[] | undefined,
  ctx: RenderActionChainCtx,
): string {
  const parts: string[] = [];
  for (const action of actions ?? []) {
    let dp = AsteriskDialplanUtils.actionToDialplan(
      action,
      ctx.vpbxUserUid,
      ctx.isAdmin ?? false,
      ctx.wh ?? {},
    );
    if (!dp) continue;
    const tgExpr = ctx.timeGroup
      ?? (typeof action?.condition?.time_group_uid === 'number'
        ? `"\${WT_${action.condition.time_group_uid}}"="1"`
        : '');
    if (tgExpr) dp = wrapEachLine(tgExpr, dp);
    parts.push(dp);
  }
  return parts.join('\nsame => n,');
}
