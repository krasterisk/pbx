"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmiEventType = exports.TrunkType = exports.RouteDirection = exports.PeerType = exports.CallDisposition = exports.PeerStatus = exports.AgentStatus = exports.UserLevel = void 0;
var UserLevel;
(function (UserLevel) {
    UserLevel[UserLevel["ADMIN"] = 1] = "ADMIN";
    UserLevel[UserLevel["OPERATOR"] = 2] = "OPERATOR";
    UserLevel[UserLevel["SUPERVISOR"] = 3] = "SUPERVISOR";
    UserLevel[UserLevel["READONLY"] = 5] = "READONLY";
})(UserLevel || (exports.UserLevel = UserLevel = {}));
var AgentStatus;
(function (AgentStatus) {
    AgentStatus["READY"] = "READY";
    AgentStatus["PAUSE"] = "PAUSE";
    AgentStatus["BUSY"] = "BUSY";
    AgentStatus["FINISH"] = "FINISH";
    AgentStatus["BEGIN"] = "BEGIN";
})(AgentStatus || (exports.AgentStatus = AgentStatus = {}));
var PeerStatus;
(function (PeerStatus) {
    PeerStatus["ONLINE"] = "ONLINE";
    PeerStatus["OFFLINE"] = "OFFLINE";
    PeerStatus["UNREACHABLE"] = "UNREACHABLE";
})(PeerStatus || (exports.PeerStatus = PeerStatus = {}));
var CallDisposition;
(function (CallDisposition) {
    CallDisposition["ANSWERED"] = "ANSWERED";
    CallDisposition["NO_ANSWER"] = "NO ANSWER";
    CallDisposition["BUSY"] = "BUSY";
    CallDisposition["CONGESTION"] = "CONGESTION";
    CallDisposition["FAILED"] = "FAILED";
})(CallDisposition || (exports.CallDisposition = CallDisposition = {}));
var PeerType;
(function (PeerType) {
    PeerType["SIP"] = "SIP";
    PeerType["IAX2"] = "IAX2";
    PeerType["PJSIP"] = "PJSIP";
})(PeerType || (exports.PeerType = PeerType = {}));
var RouteDirection;
(function (RouteDirection) {
    RouteDirection["INBOUND"] = "inbound";
    RouteDirection["OUTBOUND"] = "outbound";
})(RouteDirection || (exports.RouteDirection = RouteDirection = {}));
var TrunkType;
(function (TrunkType) {
    TrunkType["SIP"] = "SIP";
    TrunkType["IAX2"] = "IAX2";
    TrunkType["PJSIP"] = "PJSIP";
    TrunkType["CUSTOM"] = "CUSTOM";
})(TrunkType || (exports.TrunkType = TrunkType = {}));
var AmiEventType;
(function (AmiEventType) {
    AmiEventType["PEER_STATUS"] = "peerstatus";
    AmiEventType["QUEUE_MEMBER_STATUS"] = "queuememberstatus";
    AmiEventType["NEW_CHANNEL"] = "newchannel";
    AmiEventType["HANGUP"] = "hangup";
    AmiEventType["BRIDGE_ENTER"] = "bridgeenter";
    AmiEventType["BRIDGE_LEAVE"] = "bridgeleave";
    AmiEventType["AGENT_CALLED"] = "agentcalled";
    AmiEventType["AGENT_COMPLETE"] = "agentcomplete";
    AmiEventType["QUEUE_CALLER_JOIN"] = "queuecallerjoin";
    AmiEventType["QUEUE_CALLER_LEAVE"] = "queuecallerleave";
})(AmiEventType || (exports.AmiEventType = AmiEventType = {}));
//# sourceMappingURL=index.js.map