import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'ps_endpoints', timestamps: false, freezeTableName: true })
export class PsEndpoint extends Model {
  @Column({ type: DataType.STRING(255), primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare transport: string;

  @Column({ type: DataType.STRING(2048), allowNull: true })
  declare aors: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare auth: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare context: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare disallow: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare allow: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare direct_media: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare connected_line_method: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare direct_media_method: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare direct_media_glare_mitigation: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare disable_direct_media_on_nat: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare dtmf_mode: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare external_media_address: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare force_rport: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare ice_support: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare identify_by: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare mailboxes: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare moh_suggest: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare outbound_auth: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare outbound_proxy: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare rewrite_contact: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare rtp_ipv6: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare rtp_symmetric: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare send_diversion: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare send_pai: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare send_rpid: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare timers_min_se: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare timers: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare timers_sess_expires: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare callerid: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare callerid_privacy: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare callerid_tag: string;

  @Column({ type: DataType.STRING(40), allowNull: true, field: '100rel' })
  declare rel_100: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare aggregate_mwi: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare trust_id_inbound: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare trust_id_outbound: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare use_ptime: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare use_avpf: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare media_encryption: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare inband_progress: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare call_group: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare pickup_group: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare named_call_group: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare named_pickup_group: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare device_state_busy_at: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare fax_detect: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare t38_udptl: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare t38_udptl_ec: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare t38_udptl_maxdatagram: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare t38_udptl_nat: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare t38_udptl_ipv6: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare tone_zone: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare language: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare one_touch_recording: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare record_on_feature: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare record_off_feature: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare rtp_engine: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare allow_transfer: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare allow_subscribe: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare sdp_owner: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare sdp_session: string;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare tos_audio: string;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare tos_video: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare cos_audio: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare cos_video: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare sub_min_expiry: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare from_domain: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare from_user: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare mwi_from_user: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare dtls_verify: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare dtls_rekey: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare dtls_cert_file: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare dtls_private_key: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare dtls_cipher: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare dtls_ca_file: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  declare dtls_ca_path: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare dtls_setup: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare srtp_tag_32: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare media_address: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare redirect_method: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare set_var: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare accountcode: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare user_eq_phone: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare moh_passthrough: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare media_encryption_optimistic: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare rpid_immediate: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare g726_non_standard: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare rtp_keepalive: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare rtp_timeout: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare rtp_timeout_hold: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare bind_rtp_to_media_address: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare voicemail_extension: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare mwi_subscribe_replaces_unsolicited: string;

  @Column({ type: DataType.STRING(95), allowNull: true })
  declare deny: string;

  @Column({ type: DataType.STRING(95), allowNull: true })
  declare permit: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare acl: string;

  @Column({ type: DataType.STRING(95), allowNull: true })
  declare contact_deny: string;

  @Column({ type: DataType.STRING(95), allowNull: true })
  declare contact_permit: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare contact_acl: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare subscribe_context: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare fax_detect_timeout: number;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare contact_user: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare preferred_codec_only: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare asymmetric_rtp_codec: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare rtcp_mux: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare allow_overlap: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare refer_blind_progress: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare notify_early_inuse_ringing: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare max_audio_streams: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare max_video_streams: number;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare webrtc: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare dtls_fingerprint: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare incoming_mwi_mailbox: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare bundle: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare dtls_auto_generate_cert: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare follow_early_media_fork: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare accept_multiple_sdp_answers: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare suppress_q850_reason_headers: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare trust_connected_line: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare send_connected_line: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare ignore_183_without_sdp: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare codec_prefs_incoming_offer: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare codec_prefs_outgoing_offer: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare codec_prefs_incoming_answer: string;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare codec_prefs_outgoing_answer: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare stir_shaken: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare send_history_info: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare allow_unauthenticated_options: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare t38_bind_udptl_to_media_address: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare geoloc_incoming_call_profile: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare geoloc_outgoing_call_profile: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare incoming_call_offer_pref: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare outgoing_call_offer_pref: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare stir_shaken_profile: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare security_negotiation: string;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare security_mechanisms: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare send_aoc: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare overlap_context: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare media_use_received_transport: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare force_avp: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare message_context: string;

  // Asterisk 22.8 multi-tenant field
  @Column({ type: DataType.STRING(80), allowNull: true })
  declare tenantid: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare suppress_moh_on_sendonly: string;

  @Column({ type: DataType.STRING(95), allowNull: true })
  declare follow_redirect_methods: string;

  // Custom AI PBX UI & Auto-Provision columns
  @Column({ type: DataType.STRING(255), allowNull: true, defaultValue: '' })
  declare department: string;

  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  declare provision_enabled: boolean;

  @Column({ type: DataType.STRING(100), allowNull: true, defaultValue: '' })
  declare mac_address: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare provision_template_id: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare pv_vars: string;
}
