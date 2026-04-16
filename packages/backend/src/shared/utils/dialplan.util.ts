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

  /** Convert a single JSON action to dialplan text */
  static actionToDialplan(action: any, vpbxUserUid: number, isAdmin: boolean = false): string {
    const { type, params = {}, condition = {} } = action;
    let dp = '';
    let wrapper = '';
    let closing = '';

    // Condition wrapper (DIALSTATUS) — whitelist validation
    if (condition.dialstatus) {
      if (!VALID_DIALSTATUSES.includes(condition.dialstatus)) {
        // Invalid dialstatus — skip wrapping, emit a NoOp warning
        return `NoOp(Invalid dialstatus: ${this.sanitizeDialplanInput(condition.dialstatus)})`;
      }
      wrapper = `ExecIf($["\${DIALSTATUS}" = "${condition.dialstatus}"]?`;
      closing = ')';
    }

    switch (type) {
      case 'totrunk': {
        const dest = this.sanitizeDialplanInput(params.dest) || '${EXTEN}';
        const trunk = this.sanitizeDialplanInput(params.trunk) || '';
        const timeout = parseInt(params.timeout, 10) || 60;
        const options = this.sanitizeDialplanInput(params.options) || 'tT';
        dp = `${wrapper}Dial(${trunk}/${dest},${timeout},${options})${closing}`;
        break;
      }
      case 'toexten': {
        // Backend adds PJSIP/ prefix — UI stores only the extension number
        const rawExten = this.sanitizeDialplanInput(params.exten) || '${EXTEN}';
        const exten = rawExten.includes('/') ? rawExten : `PJSIP/${rawExten}`;
        const timeout = parseInt(params.timeout, 10) || 30;
        const options = this.sanitizeDialplanInput(params.options) || 'tThH';
        dp = `${wrapper}Dial(${exten},${timeout},${options})${closing}`;
        break;
      }
      case 'toqueue': {
        const queue = this.sanitizeDialplanInput(params.queue) || '${EXTEN}';
        const timeout = params.timeout ? parseInt(params.timeout, 10) : '';
        const options = this.sanitizeDialplanInput(params.options) || 'thH';
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
          ? `${wrapper}Gosub(voicerobot_${robotUid},s,1)${closing}`
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
        const options = this.sanitizeDialplanInput(params.options) || 'tT';
        dp = numbers
          ? `${wrapper}Dial(${numbers},${timeout},${options})${closing}`
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
      case 'sendmail':
        dp = `${wrapper}System(/usr/scripts/sendmail.php "${this.sanitizeShellInput(params.email)}" "${this.sanitizeShellInput(params.text)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")${closing}`;
        break;
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
      case 'hangup':
        dp = `${wrapper}Hangup()${closing}`;
        break;
      default:
        dp = `NoOp(Unknown action: ${this.sanitizeDialplanInput(type)})`;
    }

    return dp;
  }
}
