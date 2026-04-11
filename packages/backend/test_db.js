const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'ipbx.krasterisk.ru',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'gfhjkm',
    database: process.env.DB_NAME || 'krasterisk',
  });

  const [cols] = await conn.execute('SHOW COLUMNS FROM ps_endpoints');
  const dbCols = cols.map(c => c.Field);
  const modelCols = ['id','transport','aors','auth','context','disallow','allow','direct_media','connected_line_method','direct_media_method','direct_media_glare_mitigation','disable_direct_media_on_nat','dtmf_mode','external_media_address','force_rport','ice_support','identify_by','mailboxes','moh_suggest','outbound_auth','outbound_proxy','rewrite_contact','rtp_ipv6','rtp_symmetric','send_diversion','send_pai','send_rpid','timers_min_se','timers','timers_sess_expires','callerid','callerid_privacy','callerid_tag','100rel','aggregate_mwi','trust_id_inbound','trust_id_outbound','use_ptime','use_avpf','media_encryption','inband_progress','call_group','pickup_group','named_call_group','named_pickup_group','device_state_busy_at','fax_detect','t38_udptl','t38_udptl_ec','t38_udptl_maxdatagram','t38_udptl_nat','t38_udptl_ipv6','tone_zone','language','one_touch_recording','record_on_feature','record_off_feature','rtp_engine','allow_transfer','allow_subscribe','sdp_owner','sdp_session','tos_audio','tos_video','cos_audio','cos_video','sub_min_expiry','from_domain','from_user','mwi_from_user','dtls_verify','dtls_rekey','dtls_cert_file','dtls_private_key','dtls_cipher','dtls_ca_file','dtls_ca_path','dtls_setup','srtp_tag_32','media_address','redirect_method','set_var','accountcode','user_eq_phone','moh_passthrough','media_encryption_optimistic','rpid_immediate','g726_non_standard','rtp_keepalive','rtp_timeout','rtp_timeout_hold','bind_rtp_to_media_address','voicemail_extension','mwi_subscribe_replaces_unsolicited','deny','permit','acl','contact_deny','contact_permit','contact_acl','subscribe_context','fax_detect_timeout','contact_user','preferred_codec_only','asymmetric_rtp_codec','rtcp_mux','allow_overlap','refer_blind_progress','notify_early_inuse_ringing','max_audio_streams','max_video_streams','webrtc','dtls_fingerprint','incoming_mwi_mailbox','bundle','dtls_auto_generate_cert','follow_early_media_fork','accept_multiple_sdp_answers','suppress_q850_reason_headers','trust_connected_line','send_connected_line','ignore_183_without_sdp','codec_prefs_incoming_offer','codec_prefs_outgoing_offer','codec_prefs_incoming_answer','codec_prefs_outgoing_answer','stir_shaken','send_history_info','allow_unauthenticated_options','t38_bind_udptl_to_media_address','geoloc_incoming_call_profile','geoloc_outgoing_call_profile','incoming_call_offer_pref','outgoing_call_offer_pref','stir_shaken_profile','security_negotiation','security_mechanisms','send_aoc','overlap_context','media_use_received_transport','force_avp','message_context','tenantid','suppress_moh_on_sendonly','follow_redirect_methods','department','provision_enabled','mac_address','provision_template_id','pv_vars'];
  
  const missing = modelCols.filter(m => !dbCols.includes(m));
  console.log(`Adding ${missing.length} missing columns to ps_endpoints...`);
  
  for (const col of missing) {
    let type = 'VARCHAR(40)';
    if (['timers_min_se','timers_sess_expires','device_state_busy_at','t38_udptl_maxdatagram','cos_audio','cos_video','sub_min_expiry','rtp_keepalive','rtp_timeout','rtp_timeout_hold','fax_detect_timeout','max_audio_streams','max_video_streams'].includes(col)) {
      type = 'INTEGER';
    } else if (col === 'set_var') {
      type = 'TEXT';
    } else if (col.startsWith('codec_prefs_')) {
      type = 'VARCHAR(128)';
    } else if (col === 'security_mechanisms') {
      type = 'VARCHAR(512)';
    } else if (['deny','permit','contact_deny','contact_permit','follow_redirect_methods'].includes(col)) {
      type = 'VARCHAR(95)';
    } else if (['geoloc_incoming_call_profile','geoloc_outgoing_call_profile','stir_shaken_profile','overlap_context','contact_user','accountcode'].includes(col)) {
      type = 'VARCHAR(80)';
    }
    await conn.execute(`ALTER TABLE ps_endpoints ADD COLUMN ${col} ${type} DEFAULT NULL`);
    console.log(`Added column ${col}`);
  }
  
  await conn.end();
}

main().catch(console.error);
