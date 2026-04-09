export declare enum UserLevel {
    ADMIN = 1,
    OPERATOR = 2,
    SUPERVISOR = 3,
    READONLY = 5
}
export declare enum AgentStatus {
    READY = "READY",
    PAUSE = "PAUSE",
    BUSY = "BUSY",
    FINISH = "FINISH",
    BEGIN = "BEGIN"
}
export declare enum PeerStatus {
    ONLINE = "ONLINE",
    OFFLINE = "OFFLINE",
    UNREACHABLE = "UNREACHABLE"
}
export declare enum CallDisposition {
    ANSWERED = "ANSWERED",
    NO_ANSWER = "NO ANSWER",
    BUSY = "BUSY",
    CONGESTION = "CONGESTION",
    FAILED = "FAILED"
}
export declare enum PeerType {
    SIP = "SIP",
    IAX2 = "IAX2",
    PJSIP = "PJSIP"
}
export declare enum RouteDirection {
    INBOUND = "inbound",
    OUTBOUND = "outbound"
}
export declare enum TrunkType {
    SIP = "SIP",
    IAX2 = "IAX2",
    PJSIP = "PJSIP",
    CUSTOM = "CUSTOM"
}
export declare enum AmiEventType {
    PEER_STATUS = "peerstatus",
    QUEUE_MEMBER_STATUS = "queuememberstatus",
    NEW_CHANNEL = "newchannel",
    HANGUP = "hangup",
    BRIDGE_ENTER = "bridgeenter",
    BRIDGE_LEAVE = "bridgeleave",
    AGENT_CALLED = "agentcalled",
    AGENT_COMPLETE = "agentcomplete",
    QUEUE_CALLER_JOIN = "queuecallerjoin",
    QUEUE_CALLER_LEAVE = "queuecallerleave"
}
//# sourceMappingURL=index.d.ts.map