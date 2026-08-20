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
  members?: ICallGroupMember[];
}
