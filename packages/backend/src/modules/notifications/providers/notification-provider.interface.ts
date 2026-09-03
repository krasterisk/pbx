/**
 * Decrypted integration as returned by NotificationsService.findByUidInternal.
 * Credentials are plaintext only in memory at send time — never log them.
 */
export interface DecryptedNotificationIntegration {
  uid: number;
  name: string;
  channel: 'telegram' | 'email' | 'whatsapp' | 'webhook' | 'max' | 'vk';
  config: Record<string, any> | null;
  credentials: Record<string, any>;
  user_uid?: number;
  encrypted_credentials?: string | null;
}

export interface NotificationSendResult {
  success: boolean;
  error?: string;
}

/** Telegram payload/format rejection (4xx). Distinct from transport/5xx. */
export const ATTACHMENT_REJECTED = 'attachment_rejected';

export interface NotificationAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface NotificationSendOptions {
  attach?: NotificationAttachment;
  extraVars?: Record<string, string>;
}

export const NOTIFICATION_MESSAGE_MAX_LEN = 4096;

export function trimNotificationMessage(message: string): string {
  const text = message ?? '';
  return text.length > NOTIFICATION_MESSAGE_MAX_LEN
    ? text.slice(0, NOTIFICATION_MESSAGE_MAX_LEN)
    : text;
}

/**
 * Per-channel outbound notification sender (fire-and-forget safe).
 * Implementations must never throw and must never log decrypted tokens.
 */
export interface INotificationProvider {
  send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
    options?: NotificationSendOptions,
  ): Promise<NotificationSendResult>;
}
