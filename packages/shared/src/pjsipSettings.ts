export type PjsipCategory =
  | "media"
  | "network"
  | "security"
  | "timers"
  | "calls"
  | "other";

export function pjsipCategory(key: string): PjsipCategory {
  if (
    /^(dtls|srtp|security|acl|contact_(acl|deny|permit)|stir_shaken|allow_unauthenticated)/.test(
      key,
    )
  )
    return "security";
  if (/timer|timeout|expiry|keepalive/.test(key)) return "timers";
  if (
    /^(rtp|rtcp|codec|media|t38|fax|sdp|tos|cos|bundle|webrtc|ice|g726|direct_media|use_(ptime|avpf)|force_avp|preferred_codec|asymmetric)/.test(
      key,
    )
  )
    return "media";
  if (
    /^(force_rport|rewrite_contact|external|outbound|from_|contact_user|user_eq|identify|bind_)/.test(
      key,
    )
  )
    return "network";
  if (
    /call|mwi|moh|record|transfer|diversion|pai|rpid|connected|overlap|refer|notify|voicemail/.test(
      key,
    )
  )
    return "calls";
  return "other";
}

const INTEGER_FIELDS = new Set([
  "timers_min_se",
  "timers_sess_expires",
  "dtls_rekey",
  "rtp_keepalive",
  "rtp_timeout",
  "rtp_timeout_hold",
  "fax_detect_timeout",
  "t38_udptl_maxdatagram",
  "device_state_busy_at",
  "sub_min_expiry",
  "max_audio_streams",
  "max_video_streams",
  "cos_audio",
  "cos_video",
]);
const BOOLEAN_FIELDS = new Set([
  "direct_media",
  "force_rport",
  "rewrite_contact",
  "rtp_symmetric",
  "ice_support",
  "webrtc",
  "rtcp_mux",
  "bundle",
  "dtls_auto_generate_cert",
]);

export function pjsipValueError(
  key: string,
  value: string,
): string | undefined {
  if (value.includes(String.fromCharCode(0)) || /[\r\n]/.test(value))
    return "endpoints.invalidParameterValue";
  if (
    INTEGER_FIELDS.has(key) &&
    (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
  )
    return "endpoints.integerParameter";
  if (BOOLEAN_FIELDS.has(key) && !["yes", "no"].includes(value))
    return "endpoints.booleanParameter";
  return undefined;
}

export function validatePjsipSettings(
  value: Record<string, string>,
  fields: readonly string[],
): boolean {
  return Object.entries(value).every(
    ([key, val]) => fields.includes(key) && !pjsipValueError(key, val),
  );
}
