"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsEndpoint = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let PsEndpoint = class PsEndpoint extends sequelize_typescript_1.Model {
};
exports.PsEndpoint = PsEndpoint;
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), primaryKey: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "transport", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(2048), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "aors", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "auth", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "context", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(200), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "disallow", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(200), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "allow", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "direct_media", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "connected_line_method", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "direct_media_method", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "direct_media_glare_mitigation", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "disable_direct_media_on_nat", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtmf_mode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "external_media_address", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "force_rport", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "ice_support", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "identify_by", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "mailboxes", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "moh_suggest", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "outbound_auth", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "outbound_proxy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "rewrite_contact", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "rtp_ipv6", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "rtp_symmetric", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "send_diversion", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "send_pai", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "send_rpid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "timers_min_se", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "timers", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "timers_sess_expires", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "callerid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "callerid_privacy", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "callerid_tag", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true, field: '100rel' }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "rel_100", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "aggregate_mwi", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "trust_id_inbound", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "trust_id_outbound", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "use_ptime", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "use_avpf", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "media_encryption", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "inband_progress", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "call_group", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "pickup_group", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "named_call_group", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "named_pickup_group", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "device_state_busy_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "fax_detect", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "t38_udptl", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "t38_udptl_ec", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "t38_udptl_maxdatagram", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "t38_udptl_nat", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "t38_udptl_ipv6", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "tone_zone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "language", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "one_touch_recording", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "record_on_feature", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "record_off_feature", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "rtp_engine", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "allow_transfer", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "allow_subscribe", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "sdp_owner", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "sdp_session", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(10), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "tos_audio", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(10), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "tos_video", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "cos_audio", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "cos_video", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "sub_min_expiry", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "from_domain", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "from_user", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "mwi_from_user", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_verify", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_rekey", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(200), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_cert_file", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(200), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_private_key", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(200), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_cipher", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(200), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_ca_file", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(200), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_ca_path", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_setup", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "srtp_tag_32", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "media_address", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "redirect_method", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "set_var", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "accountcode", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "user_eq_phone", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "moh_passthrough", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "media_encryption_optimistic", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "rpid_immediate", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "g726_non_standard", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "rtp_keepalive", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "rtp_timeout", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "rtp_timeout_hold", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "bind_rtp_to_media_address", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "voicemail_extension", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "mwi_subscribe_replaces_unsolicited", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(95), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "deny", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(95), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "permit", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "acl", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(95), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "contact_deny", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(95), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "contact_permit", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "contact_acl", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "subscribe_context", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "fax_detect_timeout", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "contact_user", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "preferred_codec_only", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "asymmetric_rtp_codec", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "rtcp_mux", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "allow_overlap", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "refer_blind_progress", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "notify_early_inuse_ringing", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "max_audio_streams", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "max_video_streams", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "webrtc", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_fingerprint", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "incoming_mwi_mailbox", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "bundle", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "dtls_auto_generate_cert", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "follow_early_media_fork", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "accept_multiple_sdp_answers", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "suppress_q850_reason_headers", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "trust_connected_line", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "send_connected_line", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "ignore_183_without_sdp", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "codec_prefs_incoming_offer", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "codec_prefs_outgoing_offer", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "codec_prefs_incoming_answer", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "codec_prefs_outgoing_answer", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "stir_shaken", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "send_history_info", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "allow_unauthenticated_options", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "t38_bind_udptl_to_media_address", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "geoloc_incoming_call_profile", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "geoloc_outgoing_call_profile", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "incoming_call_offer_pref", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "outgoing_call_offer_pref", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "stir_shaken_profile", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "security_negotiation", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "security_mechanisms", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "send_aoc", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "overlap_context", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "media_use_received_transport", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "force_avp", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "message_context", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(80), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "tenantid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(40), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "suppress_moh_on_sendonly", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(95), allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "follow_redirect_methods", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(255), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "department", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: true, defaultValue: false }),
    __metadata("design:type", Boolean)
], PsEndpoint.prototype, "provision_enabled", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(100), allowNull: true, defaultValue: '' }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "mac_address", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: true }),
    __metadata("design:type", Number)
], PsEndpoint.prototype, "provision_template_id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", String)
], PsEndpoint.prototype, "pv_vars", void 0);
exports.PsEndpoint = PsEndpoint = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ps_endpoints', timestamps: false, freezeTableName: true })
], PsEndpoint);
//# sourceMappingURL=ps-endpoint.model.js.map