/**
 * Valid Asterisk DIALSTATUS values.
 * @see https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Dialplan_Applications/Dial — DIALSTATUS section
 */
const VALID_DIALSTATUSES = [
  'CHANUNAVAIL', 'CONGESTION', 'BUSY', 'NOANSWER', 'ANSWER',
  'CANCEL', 'DONTCALL', 'TORTURE', 'INVALIDARGS',
];

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
   * Use for params that end up inside System() / SHELL() calls.
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
   * Blocks:  ${SHELL(...)}, ${SYSTEM(...)}, ${AGI(...)}, TrySystem(...)
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
      //    Matches ${SHELL(...)}, ${SYSTEM(...)}, ${AGI(...)}, ${TrySystem(...)}
      //    Case-insensitive to catch ${ SHELL(...) } etc.
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
    let wrapper = '';
    let closing = '';

    // Condition wrapper (DIALSTATUS) — whitelist + OR-join for arrays (D-19)
    const statuses: string[] = Array.isArray(condition.dialstatus)
      ? condition.dialstatus
      : condition.dialstatus ? [condition.dialstatus] : [];
    // Legacy single-string invalid → NoOp warning (preserves prior behavior)
    if (!Array.isArray(condition.dialstatus) && condition.dialstatus
        && !VALID_DIALSTATUSES.includes(condition.dialstatus)) {
      return `NoOp(Invalid dialstatus: ${this.sanitizeDialplanInput(condition.dialstatus)})`;
    }
    const valid = statuses.filter((s) => VALID_DIALSTATUSES.includes(s));
    if (valid.length) {
      const expr = valid.map((s) => `"\${DIALSTATUS}" = "${s}"`).join(' | ');
      wrapper = `ExecIf($[${expr}]?`;
      closing = ')';
    }

    switch (type) {
      case 'totrunk': {
        const dest = this.sanitizeDialplanInput(params.dest) || '${EXTEN}';
        const trunk = this.sanitizeDialplanInput(params.trunk) || '';
        const timeout = parseInt(params.timeout, 10) || 60;
        // Inject U(krsk-on-answer) when on_answer webhook is configured
        // 'dial' arg tells the subroutine which source triggered it
        const dialOpts = this.buildDialOptions(params.options || 'tT', wh);
        const dialLines: string[] = [];
        // DIALTO: attempt responsible employee first (if custom webhook returned a number)
        if (wh.custom?.url) {
          dialLines.push(`${wrapper}ExecIf($["\${DIALTO}" != ""]?Dial(${trunk}/\${DIALTO},15,${dialOpts}))${closing}`);
          dialLines.push(`ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return())`);
        }
        dialLines.push(`${wrapper}Dial(${trunk}/${dest},${timeout},${dialOpts})${closing}`);
        dp = dialLines.join('\nsame => n,');
        break;
      }
      case 'toexten': {
        // PJSIP endpoint IDs use format: e{extension}_{vpbxUserUid}
        // Two modes:
        //   1. Specific extension: params.exten = "101" → Dial(PJSIP/e101_0)
        //   2. Pattern (use EXTEN): params.useExten = true → Dial(PJSIP/e${EXTEN}_0)
        const timeout = parseInt(params.timeout, 10) || 30;
        // Inject U(krsk-on-answer) when on_answer webhook is configured
        const dialOpts = this.buildDialOptions(params.options || 'tThH', wh);
        let dialTarget: string;
        if (params.useExten) {
          dialTarget = `PJSIP/e\${EXTEN}_${vpbxUserUid}`;
        } else {
          const rawExten = this.sanitizeDialplanInput(params.exten) || '';
          if (!rawExten) {
            dp = ''; // No extension specified — skip
            break;
          }
          dialTarget = rawExten.includes('/') ? rawExten : `PJSIP/e${rawExten}_${vpbxUserUid}`;
        }
        const dialLines: string[] = [];
        // DIALTO: attempt responsible employee first (if custom webhook returned a number)
        if (wh.custom?.url) {
          dialLines.push(`${wrapper}ExecIf($["\${DIALTO}" != ""]?Dial(PJSIP/e\${DIALTO}_${vpbxUserUid},15,${dialOpts}))${closing}`);
          dialLines.push(`ExecIf($["\${DIALSTATUS}" = "ANSWER"]?Return())`);
        }
        dialLines.push(`${wrapper}Dial(${dialTarget},${timeout},${dialOpts})${closing}`);
        dp = dialLines.join('\nsame => n,');
        break;
      }
      case 'toqueue': {
        const queue = this.sanitizeDialplanInput(params.queue) || '${EXTEN}';
        const timeout = params.timeout ? parseInt(params.timeout, 10) : '';
        const options = this.sanitizeDialplanInput(params.options) || 'thH';
        // Queue on_answer: Asterisk docs confirm gosub runs on the AGENT's channel, not caller's.
        // Variable bridging from caller → agent channel is limited.
        // on_answer for Queue is handled by AMI AgentConnect event in ami.service.ts.
        // We still pass gosub param to capture MEMBERINTERFACE for the AMI handler to correlate.
        // Queue(name,options,URL,announceoverride,timeout,AGI,gosub,...)
        dp = `${wrapper}Queue(${queue},${options},,,${timeout})${closing}`;
        break;
      }
      case 'toivr': {
        const ivrUid = parseInt(params.ivr_uid, 10);
        dp = ivrUid
          ? `${wrapper}Goto(ivr_${ivrUid},start,1)${closing}`
          : `${wrapper}NoOp(Missing IVR UID)${closing}`;
        break;
      }
      case 'togroup': {
        const group = this.sanitizeDialplanInput(params.group) || '${EXTEN}';
        dp = `${wrapper}Gosub(group_${group}_${vpbxUserUid},start,1)${closing}`;
        break;
      }
      case 'voicerobot': {
        const robotUid = parseInt(params.robot_uid, 10);
        dp = robotUid
          ? `${wrapper}Stasis(krasterisk_voicerobots,${robotUid})${closing}`
          : `${wrapper}NoOp(Missing Robot UID)${closing}`;
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
          ? `${wrapper}Dial(${numbers},${timeout},${dialOpts})${closing}`
          : `${wrapper}NoOp(Empty dial list)${closing}`;
        break;
      }
      case 'toroute': {
        const ctx = this.sanitizeDialplanInput(params.context) || 'sip-in';
        const dest = this.sanitizeDialplanInput(params.extension) || '${EXTEN}';
        dp = `${wrapper}Goto(${ctx}${vpbxUserUid},${dest},1)${closing}`;
        break;
      }
      case 'playprompt': {
        const file = this.sanitizeFilePath(params.file);
        dp = `${wrapper}Playback(/usr/records/${vpbxUserUid}/sounds/${file})${closing}`;
        break;
      }
      case 'playback': {
        const file = this.sanitizeFilePath(params.file);
        dp = `${wrapper}Background(/usr/records/${vpbxUserUid}/sounds/${file})${closing}`;
        break;
      }
      case 'setclid_custom': {
        const callerid = this.sanitizeDialplanInput(params.callerid);
        dp = `${wrapper}Set(CALLERID(num)=${callerid})${closing}`;
        break;
      }
      case 'setclid_list': {
        const listUid = this.sanitizeShellInput(String(params.list_uid || ''));
        dp = `${wrapper}ExecIf($["\${SHELL(/usr/scripts/exten_setclid.php "${listUid}" "\${CLIDNUM}")}" != ""]?Set(CALLERID(num)=\${SHELL(/usr/scripts/exten_setclid.php "${listUid}" "\${CLIDNUM}")}))${closing}`;
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
          `${wrapper}Set(__KMAIL_TO=${email})${closing}`,
          `Set(__KMAIL_SUBJ=${subject})`,
          `Set(__KMAIL_TEXT=${text})`,
          `Set(MAIL_RESULT=\${CURL(${url},to=\${URIENCODE(\${KMAIL_TO})}&subject=\${URIENCODE(\${KMAIL_SUBJ})}&text=\${URIENCODE(\${KMAIL_TEXT})}${keyParam})})`,
        ];
        dp = lines.join('\nsame => n,');
        break;
      }
      case 'sendmailpeer':
        dp = `${wrapper}System(/usr/scripts/sendmailpeer.php "${this.sanitizeShellInput(params.exten)}" "${this.sanitizeShellInput(params.text)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")${closing}`;
        break;
      case 'telegram':
        dp = `${wrapper}System(/usr/scripts/telegram.php "${this.sanitizeShellInput(params.chat_id)}" "${this.sanitizeShellInput(params.text)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")${closing}`;
        break;
      case 'voicemail': {
        const vmExten = this.sanitizeDialplanInput(params.exten) || '${EXTEN}';
        dp = `${wrapper}VoiceMail(${vmExten}@default,u)${closing}`;
        break;
      }
      case 'text2speech': {
        const ttsText = this.sanitizeShellInput(params.text);
        dp = `${wrapper}AGI(say.php,"${ttsText}")${closing}`;
        break;
      }
      case 'asr':
        dp = `${wrapper}Record(/tmp/\${UNIQUEID}.wav,${parseInt(params.silence_timeout, 10) || 3},${parseInt(params.max_timer, 10) || 6})${closing}`;
        break;
      case 'keywords':
        dp = `${wrapper}Record(/tmp/\${UNIQUEID}.wav,${parseInt(params.silence_timeout, 10) || 3},${parseInt(params.max_timer, 10) || 6})${closing}`;
        break;
      case 'webhook':
        dp = `${wrapper}Set(WH_DATA=\${SHELL(/usr/scripts/webhook.php "${this.sanitizeShellInput(params.url)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")})${closing}`;
        break;
      case 'confbridge': {
        const room = this.sanitizeDialplanInput(params.room) || '${EXTEN}';
        dp = `${wrapper}ConfBridge(${room})${closing}`;
        break;
      }
      case 'cmd':
        if (!isAdmin) {
          dp = `${wrapper}NoOp(Unauthorized cmd action)${closing}`;
        } else {
          const cleanCmd = (params.command || '').replace(/[\n\r]/g, '');
          dp = `${wrapper}${cleanCmd || 'NoOp()'}${closing}`;
        }
        break;
      case 'tofax': {
        const faxEmail = this.sanitizeDialplanInput(params.email);
        dp = `${wrapper}Set(__faxmail=${faxEmail})${closing}`;
        break;
      }
      case 'label':
        dp = `NoOp()${closing}`; // labels are handled as priority labels
        break;
      case 'busy':
        dp = `${wrapper}Busy(${parseInt(params.timeout, 10) || 10})${closing}`;
        break;
      case 'notify': {
        // D-12: Set(__KNOTIFY_*) + CURL → /internal/dialplan/notify (sendmail pattern)
        const message = this.sanitizeTemplate(params.message);
        const target = this.sanitizeTemplate(params.target);
        const integrationUid = this.sanitizeDialplanInput(String(params.integration_uid ?? ''));
        const url = `${this.backendBaseUrl}/internal/dialplan/notify`;
        const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';
        const lines = [
          `${wrapper}Set(__KNOTIFY_MSG=${message})${closing}`,
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
          const lines = [`${wrapper}Set(CALLERID(num)=${callerid})${closing}`];
          if (name) lines.push(`Set(CALLERID(name)=${name})`);
          dp = lines.join('\nsame => n,');
        } else if (mode === 'phonebook') {
          const pbUid = this.sanitizeDialplanInput(String(params.phonebook_uid ?? ''));
          const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';
          const lookupUrl = `${this.backendBaseUrl}/internal/dialplan/phonebook-lookup?phonebook_uid=${pbUid}${keyParam}`;
          const lines = [
            `${wrapper}Set(PB_RAW=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})${closing}`,
            `ExecIf($["\${CUT(PB_RAW,|,1)}" = "1"]?Set(CALLERID(num)=\${CUT(PB_RAW,|,3)}))`,
          ];
          dp = lines.join('\nsame => n,');
        } else if (mode === 'setclid_list') {
          const listUid = this.sanitizeShellInput(String(params.list_uid || ''));
          dp = `${wrapper}ExecIf($["\${SHELL(/usr/scripts/exten_setclid.php "${listUid}" "\${CLIDNUM}")}" != ""]?Set(CALLERID(num)=\${SHELL(/usr/scripts/exten_setclid.php "${listUid}" "\${CLIDNUM}")}))${closing}`;
        } else if (mode === 'carousel') {
          const pool = (Array.isArray(params.pool) ? params.pool : [])
            .map((c: string) => this.sanitizeDialplanInput(c))
            .filter(Boolean);
          if (!pool.length) {
            dp = `${wrapper}NoOp(Empty CID carousel pool)${closing}`;
          } else {
            const lines = pool.map((cid: string, i: number) =>
              i === 0
                ? `${wrapper}Set(CID_1=${cid})${closing}`
                : `Set(CID_${i + 1}=${cid})`,
            );
            lines.push(`Set(CALLERID(num)=\${CID_\${RAND(1,${pool.length})}})`);
            dp = lines.join('\nsame => n,');
          }
        } else {
          dp = `${wrapper}NoOp(Unknown callerid mode)${closing}`;
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
          dp = `${wrapper}NoOp(Empty trunk carousel)${closing}`;
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
        const head = `${wrapper}Set(TC_PICK=\${RAND(1,${n})})${closing}`;
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
          ? `${wrapper}Hangup(${causecode})${closing}`
          : `${wrapper}Hangup()${closing}`;
        break;
      }
      default:
        dp = `NoOp(Unknown action: ${this.sanitizeDialplanInput(type)})`;
    }

    return dp;
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
