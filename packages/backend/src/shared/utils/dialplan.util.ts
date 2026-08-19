import { DIALPLAN_ACTION_META, HTTP_RESULT_VAR, type ActionType } from '@krasterisk/shared';
import { ActionLog } from '../../modules/logger/action-log.model';
import { normalizeTarget, resolveQueueValueSource, resolveValueSource, PHONEBOOK_TARGET_VAR } from './dialplan-target.util';
import { applyNumberManipulation } from './dialplan-number.util';
import { buildConditionExpr, isLegacyInvalidDialstatus, wrapEachLine } from './dialplan-condition.util';
import { emitHopPrologue } from './dialplan-hops.util';
import { emitPlayback } from './dialplan-playback.util';
import { buildCurlCall } from './dialplan-curl.util';

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
          dp = '';
          break;
        }
        const src = resolveValueSource(params, 'target', { stringField: 'exten', useExtenField: 'useExten' });
        let dialTarget: string;
        if (src.source === 'fixed' && this.sanitizeDialplanInput(src.value).includes('/')) {
          dialTarget = this.sanitizeDialplanInput(src.value);
        } else if (src.source === 'fixed') {
          const manipulated = applyNumberManipulation(this.sanitizeDialplanInput(src.value), params.numberManipulation);
          if (!manipulated) {
            dp = '';
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
        // Queue on_answer: Asterisk docs confirm gosub runs on the AGENT's channel, not caller's.
        // Variable bridging from caller → agent channel is limited.
        // on_answer for Queue is handled by AMI AgentConnect event in ami.service.ts.
        // We still pass gosub param to capture MEMBERINTERFACE for the AMI handler to correlate.
        // Queue(name,options,URL,announceoverride,timeout,AGI,gosub,...)
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
          dp = [
            `Set(${PHONEBOOK_TARGET_VAR}=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`,
            `ExecIf($["\${${PHONEBOOK_TARGET_VAR}}" != ""]?Queue(${queue},${options},,,${timeout}))`,
          ].join('\nsame => n,');
        } else {
          const queue = normalizeTarget('queue', src, vpbxUserUid);
          dp = `Queue(${queue},${options},,,${timeout})`;
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
      case 'playprompt': {
        const file = this.sanitizeFilePath(params.file);
        dp = `Playback(/usr/records/${vpbxUserUid}/sounds/${file})`;
        break;
      }
      case 'playback': {
        if (params.mode) {
          dp = emitPlayback(params, { vpbxUserUid });
          break;
        }
        const file = this.sanitizeFilePath(params.file);
        dp = `Background(/usr/records/${vpbxUserUid}/sounds/${file})`;
        if (params.digitExit) {
          const digit = String(params.digit ?? '');
          const dest = String(params.digitExitDest ?? '');
          if (digit && dest) {
            dp = `${dp}\nsame => n,${emitDigitExitTransition(digit, dest)}`;
          }
        }
        break;
      }
      case 'setclid_custom': {
        const callerid = this.sanitizeDialplanInput(params.callerid);
        dp = `Set(CALLERID(num)=${callerid})`;
        break;
      }
      case 'setclid_list': {
        const listUid = this.sanitizeDialplanInput(String(params.list_uid || ''));
        dp = this.emitSetclidCurl(listUid, vpbxUserUid);
        break;
      }
      case 'sendmail': {
        // Multi-line approach:
        // 1) Set channel vars — Asterisk resolves ${CALLERID(num)}, ${EXTEN}, etc. at call time
        // 2) CURL() with ${URIENCODE()} for runtime percent-encoding (handles Cyrillic)
        //
        // User can use any Asterisk channel variable in subject/text, e.g.:
        //   "Звонок от ${CALLERID(num)} на ${EXTEN}"
        //
        // sanitizeTemplate() blocks dangerous functions (SHELL, SYSTEM, AGI)
        // and strips newlines to prevent dialplan injection.
        const email = this.sanitizeTemplate(params.email);
        const subject = this.sanitizeTemplate(params.subject);
        const text = this.sanitizeTemplate(params.text);
        const url = `${this.backendBaseUrl}/internal/dialplan/sendmail`;
        const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';

        const lines = [
          `Set(__KMAIL_TO=${email})`,
          `Set(__KMAIL_SUBJ=${subject})`,
          `Set(__KMAIL_TEXT=${text})`,
          `Set(MAIL_RESULT=\${CURL(${url},to=\${URIENCODE(\${KMAIL_TO})}&subject=\${URIENCODE(\${KMAIL_SUBJ})}&text=\${URIENCODE(\${KMAIL_TEXT})}${keyParam})})`,
        ];
        dp = lines.join('\nsame => n,');
        break;
      }
      case 'sendmailpeer':
        dp = buildCurlCall('sendmailpeer', {
          exten: this.sanitizeDialplanInput(params.exten),
          text: this.sanitizeDialplanInput(params.text),
          clid: '${CALLERID(num)}',
          called: '${EXTEN}',
          uniqueid: '${UNIQUEID}',
        }, this.curlCtx(vpbxUserUid));
        break;
      case 'telegram':
        dp = buildCurlCall('telegram', {
          chat_id: this.sanitizeDialplanInput(params.chat_id),
          text: this.sanitizeDialplanInput(params.text),
          clid: '${CALLERID(num)}',
          exten: '${EXTEN}',
          uniqueid: '${UNIQUEID}',
        }, this.curlCtx(vpbxUserUid));
        break;
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
      case 'asr':
        dp = `Record(/tmp/\${UNIQUEID}.wav,${parseInt(params.silence_timeout, 10) || 3},${parseInt(params.max_timer, 10) || 6})`;
        break;
      case 'keywords':
        dp = `Record(/tmp/\${UNIQUEID}.wav,${parseInt(params.silence_timeout, 10) || 3},${parseInt(params.max_timer, 10) || 6})`;
        break;
      case 'webhook':
        dp = buildCurlCall('webhook', {
          url: String(params.url ?? '').replace(/[\n\r"'\\]/g, ''),
          clid: '${CALLERID(num)}',
          exten: '${EXTEN}',
          uniqueid: '${UNIQUEID}',
        }, this.curlCtx(vpbxUserUid));
        break;
      case 'confbridge': {
        const room = this.sanitizeDialplanInput(params.room) || '${EXTEN}';
        dp = `ConfBridge(${room})`;
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
      case 'tofax': {
        const faxEmail = this.sanitizeDialplanInput(params.email);
        dp = `Set(__faxmail=${faxEmail})`;
        break;
      }
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
      case 'notify': {
        // D-12: Set(__KNOTIFY_*) + CURL → /internal/dialplan/notify (sendmail pattern)
        const message = this.sanitizeTemplate(params.message);
        const target = this.sanitizeTemplate(params.target);
        const integrationUid = this.sanitizeDialplanInput(String(params.integration_uid ?? ''));
        const url = `${this.backendBaseUrl}/internal/dialplan/notify`;
        const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';
        const lines = [
          `Set(__KNOTIFY_MSG=${message})`,
          `Set(__KNOTIFY_TARGET=${target})`,
          `Set(NOTIFY_RESULT=\${CURL(${url},integration_uid=${integrationUid}&message=\${URIENCODE(\${KNOTIFY_MSG})}&target=\${URIENCODE(\${KNOTIFY_TARGET})}&clid=\${URIENCODE(\${CALLERID(num)})}&exten=\${URIENCODE(\${EXTEN})}&uniqueid=\${URIENCODE(\${UNIQUEID})}${keyParam})})`,
        ];
        dp = lines.join('\nsame => n,');
        break;
      }
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
            lines.push(`Set(CALLERID(num)=\${CID_\${RAND(1,${pool.length})}})`);
            dp = lines.join('\nsame => n,');
          }
        } else {
          dp = `NoOp(Unknown callerid mode)`;
        }
        break;
      }
      case 'trunk_carousel': {
        // D-15: random_then_failover Dial loop with per-trunk CID; Return on ANSWER (never Hangup)
        const trunks: Array<{
          trunk?: string;
          cid_mode?: string;
          callerid?: string;
          phonebook_uid?: number;
        }> = Array.isArray(params.trunks) ? params.trunks : [];
        if (!trunks.length) {
          dp = `NoOp(Empty trunk carousel)`;
          break;
        }
        const n = trunks.length;
        const timeout = parseInt(params.timeout, 10) || 60;
        const dialOpts = this.sanitizeDialplanInput(params.options || 'tT');
        const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';

        const cidApps = (item: (typeof trunks)[0]): string[] => {
          if (item.cid_mode === 'phonebook') {
            const pbUid = this.sanitizeDialplanInput(String(item.phonebook_uid ?? ''));
            const lookupUrl = `${this.backendBaseUrl}/internal/dialplan/phonebook-lookup?phonebook_uid=${pbUid}${keyParam}`;
            return [
              `Set(TC_PB=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`,
              `ExecIf($["\${CUT(TC_PB,|,1)}" = "1"]?Set(CALLERID(num)=\${CUT(TC_PB,|,3)}))`,
            ];
          }
          const cid = this.sanitizeDialplanInput(item.callerid);
          return cid ? [`Set(CALLERID(num)=${cid})`] : [];
        };

        // First line + subsequent "same => <priority>,<app>" parts (labels need n(tN) form)
        const head = `Set(TC_PICK=\${RAND(1,${n})})`;
        const rest: string[] = [];
        for (let i = 1; i < n; i++) {
          rest.push(`n,GotoIf($["\${TC_PICK}" = "${i}"]?t${i})`);
        }
        rest.push(`n,Goto(t${n})`);

        for (let start = 0; start < n; start++) {
          let labeled = false;
          for (let j = 0; j < n; j++) {
            const item = trunks[(start + j) % n];
            const trunk = this.sanitizeDialplanInput(item.trunk);
            const apps = [
              ...cidApps(item),
              `Dial(${trunk}/\${EXTEN},${timeout},${dialOpts})`,
              j < n - 1
                ? `ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return())`
                : 'Return()',
            ];
            for (const app of apps) {
              if (!labeled) {
                rest.push(`n(t${start + 1}),${app}`);
                labeled = true;
              } else {
                rest.push(`n,${app}`);
              }
            }
          }
        }

        dp = [head, ...rest.map((r) => `same => ${r}`)].join('\n');
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
