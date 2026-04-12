const mysql = require('mysql2/promise');

// Models define these columns — extracted manually from .model.ts files
const MODELS = {
  ps_endpoints: [
    'id','transport','aors','auth','context','disallow','allow','direct_media',
    'connected_line_method','direct_media_method','direct_media_glare_mitigation',
    'disable_direct_media_on_nat','dtmf_mode','external_media_address','force_rport',
    'ice_support','identify_by','mailboxes','moh_suggest','outbound_auth','outbound_proxy',
    'rewrite_contact','rtp_ipv6','rtp_symmetric','send_diversion','send_pai','send_rpid',
    'timers_min_se','timers','timers_sess_expires','callerid','callerid_privacy','callerid_tag',
    '100rel','aggregate_mwi','trust_id_inbound','trust_id_outbound','use_ptime','use_avpf',
    'media_encryption','inband_progress','call_group','pickup_group','named_call_group',
    'named_pickup_group','device_state_busy_at','fax_detect','t38_udptl','t38_udptl_ec',
    't38_udptl_maxdatagram','t38_udptl_nat','t38_udptl_ipv6','tone_zone','language',
    'one_touch_recording','record_on_feature','record_off_feature','rtp_engine',
    'allow_transfer','allow_subscribe','sdp_owner','sdp_session','tos_audio','tos_video',
    'cos_audio','cos_video','sub_min_expiry','from_domain','from_user','mwi_from_user',
    'dtls_verify','dtls_rekey','dtls_cert_file','dtls_private_key','dtls_cipher',
    'dtls_ca_file','dtls_ca_path','dtls_setup','srtp_tag_32','media_address',
    'redirect_method','set_var','accountcode','user_eq_phone','moh_passthrough',
    'media_encryption_optimistic','rpid_immediate','g726_non_standard','rtp_keepalive',
    'rtp_timeout','rtp_timeout_hold','bind_rtp_to_media_address','voicemail_extension',
    'mwi_subscribe_replaces_unsolicited','deny','permit','acl','contact_deny',
    'contact_permit','contact_acl','subscribe_context','fax_detect_timeout','contact_user',
    'preferred_codec_only','asymmetric_rtp_codec','rtcp_mux','allow_overlap',
    'refer_blind_progress','notify_early_inuse_ringing','max_audio_streams','max_video_streams',
    'webrtc','dtls_fingerprint','incoming_mwi_mailbox','bundle','dtls_auto_generate_cert',
    'follow_early_media_fork','accept_multiple_sdp_answers','suppress_q850_reason_headers',
    'trust_connected_line','send_connected_line','ignore_183_without_sdp',
    'codec_prefs_incoming_offer','codec_prefs_outgoing_offer','codec_prefs_incoming_answer',
    'codec_prefs_outgoing_answer','stir_shaken','send_history_info',
    'allow_unauthenticated_options','t38_bind_udptl_to_media_address',
    'geoloc_incoming_call_profile','geoloc_outgoing_call_profile',
    'incoming_call_offer_pref','outgoing_call_offer_pref','stir_shaken_profile',
    'security_negotiation','security_mechanisms','send_aoc','overlap_context',
    'media_use_received_transport','force_avp','message_context','tenantid',
    'suppress_moh_on_sendonly','follow_redirect_methods',
    // Custom columns
    'department','provision_enabled','mac_address','provision_template_id','pv_vars'
  ],
  ps_auths: [
    'id','auth_type','nonce_lifetime','md5_cred','password','realm','username',
    'refresh_token','oauth_clientid','oauth_secret',
    'password_digest','supported_algorithms_uas','supported_algorithms_uac'
  ],
  ps_aors: [
    'id','contact','default_expiration','mailboxes','max_contacts','minimum_expiration',
    'maximum_expiration','remove_existing','qualify_frequency','authenticate_qualify',
    'qualify_timeout','outbound_proxy','support_path','voicemail_extension',
    'remove_unavailable','qualify_2xx_only'
  ],
  ps_contacts: [
    'id','uri','expiration_time','qualify_frequency','outbound_proxy','path',
    'user_agent','qualify_timeout','reg_server','authenticate_qualify','via_addr',
    'via_port','call_id','endpoint','prune_on_boot','qualify_2xx_only','updatedAt'
  ],
  ps_registrations: [
    'id','auth_rejection_permanent','client_uri','contact_user','expiration',
    'max_retries','outbound_auth','outbound_proxy','retry_interval',
    'forbidden_retry_interval','server_uri','transport','support_path',
    'line','endpoint','type'
  ],
  ps_endpoint_id_ips: [
    'id','endpoint','match','srv_lookups','match_header','type'
  ],
};

(async () => {
  const c = await mysql.createConnection({
    host: 'ipbx.krasterisk.ru',
    user: 'krasterisk',
    password: 'gfhjkm',
    database: 'krasterisk',
  });

  let totalMissing = 0;
  let totalExtra = 0;

  for (const [table, modelFields] of Object.entries(MODELS)) {
    try {
      const [cols] = await c.query(`DESCRIBE ${table}`);
      const dbFields = cols.map(r => r.Field);

      const missingInModel = dbFields.filter(f => !modelFields.includes(f));
      const missingInDb = modelFields.filter(f => !dbFields.includes(f));

      if (missingInModel.length === 0 && missingInDb.length === 0) {
        console.log(`\n✅ ${table}: OK (${dbFields.length} cols match)`);
      } else {
        console.log(`\n⚠️  ${table}:`);
        if (missingInModel.length) {
          console.log(`  DB has but MODEL missing: ${missingInModel.join(', ')}`);
          totalMissing += missingInModel.length;
        }
        if (missingInDb.length) {
          console.log(`  MODEL has but DB missing: ${missingInDb.join(', ')}`);
          totalExtra += missingInDb.length;
        }
      }
    } catch(e) {
      console.log(`\n❌ ${table}: ${e.message}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Fields in DB but not in models: ${totalMissing}`);
  console.log(`Fields in models but not in DB: ${totalExtra}`);

  await c.end();
})().catch(e => console.error(e));
