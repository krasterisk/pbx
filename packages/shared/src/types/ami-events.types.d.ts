import { AmiEventType, PeerStatus } from '../enums';
export interface IAmiEvent {
    event: AmiEventType;
    timestamp: string;
    [key: string]: any;
}
export interface IPeerStatusEvent {
    event: AmiEventType.PEER_STATUS;
    peer: string;
    peerstatus: PeerStatus;
    address: string;
}
export interface IQueueMemberStatusEvent {
    event: AmiEventType.QUEUE_MEMBER_STATUS;
    queue: string;
    membername: string;
    interface: string;
    status: number;
    paused: number;
    callstaken: number;
    lastcall: number;
}
export interface INewChannelEvent {
    event: AmiEventType.NEW_CHANNEL;
    channel: string;
    calleridnum: string;
    calleridname: string;
    exten: string;
    context: string;
    uniqueid: string;
}
export interface IHangupEvent {
    event: AmiEventType.HANGUP;
    channel: string;
    calleridnum: string;
    uniqueid: string;
    cause: string;
    'cause-txt': string;
}
export interface IActiveCall {
    uniqueid: string;
    channel: string;
    calleridnum: string;
    calleridname: string;
    exten: string;
    context: string;
    duration: number;
    state: string;
    bridgedChannel?: string;
}
export interface IDashboardData {
    activeCalls: number;
    totalPeers: number;
    onlinePeers: number;
    totalAgents: number;
    readyAgents: number;
    queuesCalls: number;
}
//# sourceMappingURL=ami-events.types.d.ts.map