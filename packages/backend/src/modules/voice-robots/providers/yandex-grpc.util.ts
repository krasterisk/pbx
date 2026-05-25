import { Logger } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';

/** gRPC status code → human-readable name */
const GRPC_CODE_NAMES: Record<number, string> = {
  [grpc.status.OK]: 'OK',
  [grpc.status.CANCELLED]: 'CANCELLED',
  [grpc.status.UNKNOWN]: 'UNKNOWN',
  [grpc.status.INVALID_ARGUMENT]: 'INVALID_ARGUMENT',
  [grpc.status.DEADLINE_EXCEEDED]: 'DEADLINE_EXCEEDED',
  [grpc.status.NOT_FOUND]: 'NOT_FOUND',
  [grpc.status.ALREADY_EXISTS]: 'ALREADY_EXISTS',
  [grpc.status.PERMISSION_DENIED]: 'PERMISSION_DENIED',
  [grpc.status.RESOURCE_EXHAUSTED]: 'RESOURCE_EXHAUSTED',
  [grpc.status.FAILED_PRECONDITION]: 'FAILED_PRECONDITION',
  [grpc.status.ABORTED]: 'ABORTED',
  [grpc.status.OUT_OF_RANGE]: 'OUT_OF_RANGE',
  [grpc.status.UNIMPLEMENTED]: 'UNIMPLEMENTED',
  [grpc.status.INTERNAL]: 'INTERNAL',
  [grpc.status.UNAVAILABLE]: 'UNAVAILABLE',
  [grpc.status.DATA_LOSS]: 'DATA_LOSS',
  [grpc.status.UNAUTHENTICATED]: 'UNAUTHENTICATED',
};

/** Likely operational cause for operators reading logs */
export function grpcErrorHint(code: number): string {
  switch (code) {
    case grpc.status.UNAUTHENTICATED:
      return 'Invalid or expired IAM token / API key, or wrong Authorization header (Bearer vs Api-Key)';
    case grpc.status.PERMISSION_DENIED:
      return 'No SpeechKit role on folder, wrong folder_id, or service account lacks access';
    case grpc.status.RESOURCE_EXHAUSTED:
      return 'Quota exceeded or billing balance — check Yandex Cloud billing and SpeechKit limits';
    case grpc.status.UNAVAILABLE:
      return 'Yandex endpoint unreachable or temporary outage — check network and stt/tts.api.cloud.yandex.net:443';
    case grpc.status.INVALID_ARGUMENT:
      return 'Bad request parameters (model, voice, language, audio format)';
    case grpc.status.DEADLINE_EXCEEDED:
      return 'Request timed out';
    default:
      return 'See message/details above and Yandex Cloud console';
  }
}

export function grpcCodeName(code: number): string {
  return GRPC_CODE_NAMES[code] ?? `CODE_${code}`;
}

export function isYandexSpeechVerbose(): boolean {
  return process.env.DEBUG_YANDEX_SPEECHKIT === '1'
    || process.env.DEBUG_YANDEX_STT === '1'
    || process.env.DEBUG_YANDEX_TTS === '1';
}

/** Mask secrets for logs */
export function maskToken(token?: string): string {
  if (!token) return '(empty)';
  if (token.length <= 8) return '***';
  return `${token.slice(0, 6)}…${token.slice(-4)} (${token.length} chars)`;
}

export function logYandexEngineConfig(
  logger: Logger,
  service: 'STT' | 'TTS',
  token: string,
  settings: Record<string, any>,
  extra?: Record<string, string | number | undefined>,
): void {
  const folderId = settings?.folder_id;
  if (!token?.trim()) {
    logger.error(`[Yandex ${service}] Missing token — requests will fail with UNAUTHENTICATED`);
  } else if (!token.startsWith('t1.') && !token.startsWith('AQVN')) {
    logger.warn(
      `[Yandex ${service}] Unrecognized token format (${maskToken(token)}) — ` +
      'expected IAM (t1.*) or API key (AQVN*)',
    );
  }
  if (!folderId) {
    logger.warn(`[Yandex ${service}] settings.folder_id is empty — may cause PERMISSION_DENIED`);
  }
  const authMode = token.startsWith('AQVN') ? 'Api-Key (if supported by caller)' : 'Bearer IAM';
  const parts = [
    `folder=${folderId || '(none)'}`,
    `token=${maskToken(token)}`,
    `auth=${authMode}`,
    ...Object.entries(extra || {})
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${v}`),
  ];
  logger.log(`[Yandex ${service}] Session config: ${parts.join(', ')}`);
}

export function formatGrpcError(err: any): string {
  const code = typeof err?.code === 'number' ? err.code : -1;
  const name = grpcCodeName(code);
  const hint = code >= 0 ? grpcErrorHint(code) : '';
  const lines = [
    `code=${code} (${name})`,
    `message=${err?.message || '(none)'}`,
  ];
  if (err?.details) {
    lines.push(`details=${err.details}`);
  }
  const meta = metadataToString(err?.metadata);
  if (meta) {
    lines.push(`metadata=${meta}`);
  }
  if (hint) {
    lines.push(`hint=${hint}`);
  }
  return lines.join('; ');
}

function metadataToString(metadata: grpc.Metadata | undefined): string {
  if (!metadata?.getMap) return '';
  try {
    const map = metadata.getMap();
    const keys = Object.keys(map);
    if (keys.length === 0) return '';
    return keys.map(k => `${k}=${map[k]}`).join(', ');
  } catch {
    return '';
  }
}

export function logGrpcError(logger: Logger, prefix: string, err: any): void {
  logger.error(`${prefix} ${formatGrpcError(err)}`);
}

/** Summarize StreamingResponse keys for verbose debug (STT) */
export function summarizeSttResponse(response: any): string {
  if (!response || typeof response !== 'object') return String(response);
  const keys = Object.keys(response).filter(k => response[k] != null);
  const parts: string[] = [`events=[${keys.join(',')}]`];
  if (response.status_code) {
    parts.push(
      `status=${response.status_code.code_type}` +
      (response.status_code.message ? ` msg="${response.status_code.message}"` : ''),
    );
  }
  if (response.partial) {
    const t = response.partial.alternatives?.[0]?.text ?? '';
    parts.push(`partial_len=${t.length}`);
  }
  if (response.final) {
    const t = response.final.alternatives?.[0]?.text ?? '';
    parts.push(`final_len=${t.length}`);
  }
  return parts.join(' ');
}

/** Summarize TTS stream chunk for verbose debug */
export function summarizeTtsResponse(response: any): string {
  if (!response || typeof response !== 'object') return String(response);
  const keys = Object.keys(response).filter(k => response[k] != null);
  const parts: string[] = [`keys=[${keys.join(',')}]`];
  if (response.audio_chunk?.data) {
    const len = response.audio_chunk.data?.length ?? response.audio_chunk.data?.byteLength ?? 0;
    parts.push(`audio_bytes=${len}`);
  }
  if (response.text_chunk) {
    parts.push('has_text_chunk');
  }
  return parts.join(' ');
}
