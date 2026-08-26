export type RingStrategy = 'ringall' | 'hunt' | 'memoryhunt' | 'random';

export type CallGroupMemberType = 'internal' | 'external';

export interface ICallGroupMember {
  uid: number;
  call_group_uid: number;
  member_type: CallGroupMemberType;
  /** Extension number (internal) or external phone number */
  value: string;
  position: number;
  ring_time: number;
  user_uid: number;
}

export interface ICallGroup {
  uid: number;
  name: string;
  /** Tenant-unique dialable number; keys the Asterisk context `group_{exten}_{uid}` (D-33) */
  exten: string;
  strategy: RingStrategy;
  ring_time: number;
  /** Context for routing external numbers via LOCAL channel */
  external_context: string;
  cid_prefix?: string;
  user_uid: number;
  /** D-34: confirm only external members via Dial M(macro) */
  confirmExternal?: boolean;
  /** DTMF key the external callee must press after answer (default `1`) */
  confirmDigit?: string;
  /** D-34: drop busy internals via DEVICE_STATE before Dial */
  skipBusy?: boolean;
  /** Prompt file id played to the caller before ringing */
  greetingPrompt?: string;
  /** MOH class when useMohInsteadOfRingback is on */
  mohClass?: string;
  useMohInsteadOfRingback?: boolean;
  /** Per-group Dial() options; default tT */
  dialOptions?: string;
  members?: ICallGroupMember[];
}
