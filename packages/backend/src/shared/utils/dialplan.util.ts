export class AsteriskDialplanUtils {
  /** Sanitize input to prevent shell injection */
  static sanitizeShellInput(input?: string): string {
    if (!input) return '';
    // Strip characters that can be used for shell or dialplan injection: ; | & $ ` \ " ' \n \r
    return input.replace(/[;|&$`\\"'\n\r]/g, '').trim();
  }

  /** Convert a single JSON action to dialplan text */
  static actionToDialplan(action: any, vpbxUserUid: number, isAdmin: boolean = false): string {
    const { type, params = {}, condition = {} } = action;
    let dp = '';
    let wrapper = '';
    let closing = '';

    // Condition wrapper (DIALSTATUS)
    if (condition.dialstatus) {
      wrapper = `ExecIf($["\${DIALSTATUS}" = "${condition.dialstatus}"]?`;
      closing = ')';
    }

    switch (type) {
      case 'totrunk': {
        const dest = params.dest || '${EXTEN}';
        const trunk = params.trunk || '';
        const timeout = params.timeout || 60;
        const options = params.options || 'tT';
        dp = `${wrapper}Dial(${trunk}/${dest},${timeout},${options})${closing}`;
        break;
      }
      case 'toexten': {
        const exten = params.exten || '${EXTEN}';
        const timeout = params.timeout || 30;
        const options = params.options || 'tThH';
        dp = `${wrapper}Dial(${exten},${timeout},${options})${closing}`;
        break;
      }
      case 'toqueue': {
        const queue = params.queue || '${EXTEN}';
        const timeout = params.timeout || '';
        const options = params.options || 'thH';
        dp = `${wrapper}Queue(${queue},${options},,,${timeout})${closing}`;
        break;
      }
      case 'toivr':
        dp = `${wrapper}Goto(ivr_${params.ivr_uid},start,1)${closing}`;
        break;
      case 'togroup':
        dp = `${wrapper}Gosub(group_${params.group || '${EXTEN}'}_${vpbxUserUid},start,1)${closing}`;
        break;
      case 'voicerobot':
        dp = `${wrapper}Gosub(voicerobot_${params.robot_uid},s,1)${closing}`;
        break;
      case 'tolist': {
        const numbers = (params.numbers || '').split(',').map((n: string) => `LOCAL/${n.trim()}@ctx-${vpbxUserUid}`).join('&');
        const timeout = params.timeout || 30;
        const options = params.options || 'tT';
        dp = `${wrapper}Dial(${numbers},${timeout},${options})${closing}`;
        break;
      }
      case 'toroute': {
        const ctx = params.context || 'sip-in';
        const dest = params.extension || '${EXTEN}';
        dp = `${wrapper}Goto(${ctx}${vpbxUserUid},${dest},1)${closing}`;
        break;
      }
      case 'playprompt':
        dp = `${wrapper}Playback(/usr/records/${vpbxUserUid}/sounds/${params.file || ''})${closing}`;
        break;
      case 'playback':
        dp = `${wrapper}Background(/usr/records/${vpbxUserUid}/sounds/${params.file || ''})${closing}`;
        break;
      case 'setclid_custom':
        dp = `${wrapper}Set(CALLERID(num)=${params.callerid || ''})${closing}`;
        break;
      case 'setclid_list':
        dp = `${wrapper}ExecIf($["\${SHELL(/usr/scripts/exten_setclid.php "${params.list_uid}" "\${CLIDNUM}")}" != ""]?Set(CALLERID(num)=\${SHELL(/usr/scripts/exten_setclid.php "${params.list_uid}" "\${CLIDNUM}")}))${closing}`;
        break;
      case 'sendmail':
        dp = `${wrapper}System(/usr/scripts/sendmail.php "${this.sanitizeShellInput(params.email)}" "${this.sanitizeShellInput(params.text)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")${closing}`;
        break;
      case 'sendmailpeer':
        dp = `${wrapper}System(/usr/scripts/sendmailpeer.php "${this.sanitizeShellInput(params.exten)}" "${this.sanitizeShellInput(params.text)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")${closing}`;
        break;
      case 'telegram':
        dp = `${wrapper}System(/usr/scripts/telegram.php "${this.sanitizeShellInput(params.chat_id)}" "${this.sanitizeShellInput(params.text)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")${closing}`;
        break;
      case 'voicemail':
        dp = `${wrapper}VoiceMail(${params.exten || '${EXTEN}'}@default,u)${closing}`;
        break;
      case 'text2speech':
        dp = `${wrapper}AGI(say.php,"${params.text || ''}")${closing}`;
        break;
      case 'asr':
        dp = `${wrapper}Record(/tmp/\${UNIQUEID}.wav,${params.silence_timeout || 3},${params.max_timer || 6})${closing}`;
        break;
      case 'keywords':
        dp = `${wrapper}Record(/tmp/\${UNIQUEID}.wav,${params.silence_timeout || 3},${params.max_timer || 6})${closing}`;
        break;
      case 'webhook':
        dp = `${wrapper}Set(WH_DATA=\${SHELL(/usr/scripts/webhook.php "${this.sanitizeShellInput(params.url)}" "\${CALLERID(num)}" "\${EXTEN}" "\${UNIQUEID}" "${vpbxUserUid}")})${closing}`;
        break;
      case 'confbridge':
        dp = `${wrapper}ConfBridge(${params.room || '${EXTEN}'})${closing}`;
        break;
      case 'cmd':
        if (!isAdmin) {
          dp = `${wrapper}NoOp(Unauthorized cmd action)${closing}`;
        } else {
          // Admin commands shouldn't be fully shell-stripped as they are explicit Asterisk commands,
          // but we will sanitize them from newlines at least.
          const cleanCmd = (params.command || '').replace(/[\n\r]/g, '');
          dp = `${wrapper}${cleanCmd || 'NoOp()'}${closing}`;
        }
        break;
      case 'tofax':
        dp = `${wrapper}Set(__faxmail=${params.email || ''})${closing}`;
        break;
      case 'label':
        dp = `NoOp()${closing}`; // labels are handled as priority labels
        break;
      case 'busy':
        dp = `${wrapper}Busy(${params.timeout || 10})${closing}`;
        break;
      case 'hangup':
        dp = `${wrapper}Hangup()${closing}`;
        break;
      default:
        dp = `NoOp(Unknown action: ${type})`;
    }

    return dp;
  }
}
